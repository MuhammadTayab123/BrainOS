import os from "node:os";

export interface ComputerStatus {
  platform: string;
  architecture: string;
  hostname: string;
  uptimeSeconds: number;
}

export class ComputerService {
  getStatus(): ComputerStatus {
    return {
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
    };
  }
}