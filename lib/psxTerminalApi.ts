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
  /** Rupee turnover / traded value for the session when provided. */
  value?: number;
  trades?: number;
  st?: string;
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
    value?: number;
    trades?: number;
    st?: string;
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
