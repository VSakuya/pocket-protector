import {
  // ButtonItem,
  ToggleField,
  PanelSection,
  PanelSectionRow,
  SliderField,
  // Navigation,
  staticClasses,
  // sleep,
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
const getEnabled = callable<[], boolean>("get_enabled");
const getLightValue = callable<[], number>("get_light_value");
const checkShouldSuspend = callable<[], boolean>("should_suspend");
const setSuspendThreshold = callable<[threshold: number], void>("set_suspend_threshold");
const getSuspendThreshold = callable<[], number>("get_suspend_threshold");

function Content() {
  //#region Master Switch
  const [enabled, setEnabledState] = useState<boolean>(false);

  const fetchEnabledState = async () => {
    try {
      const state = await getEnabled();
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
    fetchSuspendThreshold();

    // Set up polling interval (200ms)
    const getLightValueInterval = setInterval(fetchLightValue, 200);

    // Cleanup interval on dismount to save battery
    return () => clearInterval(getLightValueInterval);
  }, []);
  //#endregion Sensor Reading

  //#region Suspend Threshold
  const [suspendThreshold, setSuspendThresholdState] = useState<number>(2);

  const fetchSuspendThreshold = async () => {
    try {
      const threshold = await getSuspendThreshold();
      setSuspendThresholdState(threshold);
    } catch (e) {
      console.error("Failed to fetch suspend threshold:", e);
    }
  };

  const handleSuspendThresholdChange = async (value: number) => {
    setSuspendThresholdState(value);
    await setSuspendThreshold(value);
  };
  //#endregion Suspend Threshold


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

      <PanelSection title="Settings">
        <PanelSectionRow>
          <SliderField
            label="Suspend Threshold"
            description="Set the light level threshold for auto-suspend (0-10)"
            min={0}
            max={100}
            step={1}
            value={suspendThreshold}
            onChange={handleSuspendThresholdChange}
          />
        </PanelSectionRow>
      </PanelSection> 
    </>
  );
}

export default definePlugin(() => {
  console.log("Pocket Protector global background service started.");


  let lastTick = Date.now();
  let cooldownUntil = Date.now() + 10000;
  let isRunning = true;

  // This interval runs constantly, even when the UI menu is closed!
  const backgroundDaemon = async () => {
    if (!isRunning) return;
    const now = Date.now();

    if (now - lastTick > 5000) {
      console.log("Pocket Protector: System wake up detected! Entering 10s cooldown.");
      cooldownUntil = now + 10000;
    }
    lastTick = now;
    try {
      if (now > cooldownUntil) {
        const suspend = await checkShouldSuspend();
        if (suspend) {
          console.log("Pocket Protector: Triggering global suspend via SteamClient!");
          if (typeof SteamClient !== 'undefined') {
            SteamClient.System.SuspendPC();
            cooldownUntil = Date.now() + 10000;
          }
        }
      }
    } catch (e) {
      console.error("Background daemon failed to reach Python backend", e);
    }
    if (isRunning) {
      setTimeout(backgroundDaemon, 2000);
    }
  }

  setTimeout(backgroundDaemon, 2000);


  return {
    name: "Pocket Protector",
    titleView: <div className={staticClasses.Title}>Pocket Protector</div>,
    content: <Content />,
    icon: <FaShip />,
    onDismount() {
      // Clean up the global interval if the plugin is unloaded
      isRunning = false;
    },
  };
});
