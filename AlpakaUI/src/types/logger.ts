// Logger types
export type LoggableValue = 
  | string 
  | number 
  | boolean 
  | Record<string, string | number | boolean | null | undefined> 
  | Array<string | number | boolean | null | undefined | Record<string, string | number | boolean | null | undefined>> 
  | null 
  | undefined;

export type LoggableError = 
  | Error 
  | string 
  | { message: string; stack?: string; name?: string };

export type TableData = Record<string, LoggableValue>[] | Record<string, LoggableValue>;
