export const PSX_TERMINAL_BASE_URL = "https://psxterminal.com";
export const PSX_TERMINAL_WS_URL = "wss://psxterminal.com/";

export type PsxTerminalTick = {
  market?: string;
  symbol?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  high?: number;
  low?: number;
  timestamp?: number;
};

export type PsxTerminalTickResponse = {
  success?: boolean;
  data?: {
    market?: string;
    symbol?: string;
    price?: number;
    change?: number;
    changePercent?: number;
    volume?: number;
    high?: number;
    low?: number;
    timestamp?: number;
  };
};

export type PsxTerminalKline = {
  timestamp: number;
  close: number;
  volume: number;
};

export type PsxTerminalKlineResponse = {
  success?: boolean;
  data?: Array<{
    timestamp?: number;
    close?: number;
    volume?: number;
  }>;
};
