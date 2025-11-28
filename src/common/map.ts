import WebSocketNode from 'ws';
export const urlMap = new Map<string, string>();
export const gameMap = new Map<string, number>();
export const wsMap = new Map<string, WebSocketNode>();
export const heartbeatMap = new Map<string, NodeJS.Timeout>();
