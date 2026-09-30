type NightExitHandler = () => Promise<void>;

let exitHandler: NightExitHandler | null = null;

export const registerNightExitAnimation = (handler: NightExitHandler): (() => void) => {
  exitHandler = handler;
  return () => {
    if (exitHandler === handler) exitHandler = null;
  };
};

export const playNightExitAnimation = async (): Promise<void> => {
  if (exitHandler) await exitHandler();
};
