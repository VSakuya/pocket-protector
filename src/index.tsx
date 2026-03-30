import {
  // ButtonItem,
  ToggleField,
  PanelSection,
  PanelSectionRow,
  // Navigation,
  staticClasses,
  // Field
} from "@decky/ui";
import {
  // addEventListener,
  // removeEventListener,
  callable,
  definePlugin,
  // toaster,
  // routerHook
} from "@decky/api"
import { useState, useEffect } from "react";
import { FaShip } from "react-icons/fa";


// import logo from "../assets/logo.png";

// Define callable functions to enable/disable the function itself
const setEnabled = callable<[enabled: boolean], boolean>("set_enabled");
const getEnabledState = callable<[], boolean>("get_enabled_state");
const getLightValue = callable<[], number>("get_light_value");
const checkShouldSuspend = callable<[], boolean>("should_suspend");

function Content() {
  //#region Master Switch
  const [enabled, setEnabledState] = useState<boolean>(false);

  const fetchEnabledState = async () => {
    try {
      const state = await getEnabledState();
      setEnabledState(state);
    } catch (e) {
      console.error("Failed to fetch enabled state:", e);
    }
  };
  const handleGlobalToggle = async (enabled: boolean) => {
    setEnabledState(enabled);
    await setEnabled(enabled);
  };
  //#endregion Master Switch

  //#region Sensor Reading
  const [lightValue, setLightValue] = useState<number | string>("Reading...");
  useEffect(() => {
    // Async function to request the sensor data
    const fetchLightValue = async () => {
      try {
        // Execute the strongly-typed callable function
        const value = await getLightValue();

        if (value === -1) {
          setLightValue("Error (-1)");
        } else {
          setLightValue(value);
        }

      } catch (e) {
        console.error("Failed to fetch light sensor value:", e);
        setLightValue("Connection Failed");
      }
    };

    // Fetch immediately on mount
    fetchLightValue();
    fetchEnabledState();

    // Set up polling interval (200ms)
    const getLightValueInterval = setInterval(fetchLightValue, 200);

    // Cleanup interval on dismount to save battery
    return () => clearInterval(getLightValueInterval);
  }, []);
  //#endregion Sensor Reading

  return (
    <>
      <PanelSection title="Controls">
        <PanelSectionRow>
          <ToggleField
            label="Enable Pocket Protector"
            description="Auto-suspend when packed in a dark bag"
            checked={enabled}
            onChange={handleGlobalToggle}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Sensor Status">
        <PanelSectionRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '16px' }}>Ambient Light Level</span>
              <span style={{ fontSize: '12px', color: '#a0a0a0' }}>Values near 0 indicate bag (Lux)</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
              {lightValue}
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  console.log("Pocket Protector global background service started.");

  // This interval runs constantly, even when the UI menu is closed!
  const backgroundDaemon = setInterval(async () => {
    try {
      const suspend = await checkShouldSuspend();
      if (suspend) {
        console.log("Pocket Protector: Triggering global suspend via SteamClient!");
        if (typeof SteamClient !== 'undefined') {
          SteamClient.System.SuspendPC();
        }
      }
    } catch (e) {
      console.error("Background daemon failed to reach Python backend", e);
    }
  }, 2000); // Check every 2 seconds to save CPU

  return {
    name: "Pocket Protector",
    titleView: <div className={staticClasses.Title}>Pocket Protector</div>,
    content: <Content />,
    icon: <FaShip />,
    onDismount() {
      // Clean up the global interval if the plugin is unloaded
      clearInterval(backgroundDaemon);
    },
  };
});
