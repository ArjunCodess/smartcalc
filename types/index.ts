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

export interface Answer {
  expr: string
  result: string | number
  assign?: boolean
}

export interface LatexExpression {
  content: string;
  position: { x: number; y: number };
  ref: React.RefObject<HTMLDivElement>;
}