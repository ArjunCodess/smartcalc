export interface MathJaxConfig {
  tex2jax: {
    inlineMath: Array<[string, string]>;
  };
}

declare global {
  interface Window {
    MathJax: {
      Hub: {
        Config: (config: MathJaxConfig) => void;
        Queue: (commands: never[]) => void;
      };
    };
  }
}

export interface GeneratedResult {
  expression: string;
  answer: string;
}

export interface Response {
  expr: string;
  result: string;
  assign: boolean;
}