"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import Draggable from "react-draggable";
import { SWATCHES } from "@/app/constants";
import { motion } from "framer-motion";
import type { GeneratedResult, Response } from "@/types";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("rgb(255, 255, 255)");
  const [reset, setReset] = useState(false);
  const [dictOfVars, setDictOfVars] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GeneratedResult>();
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
  const [latexExpressions, setLatexExpressions] = useState<Array<string>>([]);
  const [isEraser, setIsEraser] = useState(false);
  const [eraserRadius, setEraserRadius] = useState(10);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (latexExpressions.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub] as never);
      }, 0);
    }
  }, [latexExpressions]);

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexExpressions([]);
      setResult(undefined);
      setDictOfVars({});
      setReset(false);
    }
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - canvas.offsetTop;
        ctx.lineCap = "round";
        ctx.lineWidth = 3;
      }
    }
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML";
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
        },
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const renderLatexToCanvas = useCallback((expression: string, answer: string) => {
    const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
    setLatexExpressions(prev => [...prev, latex]);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  useEffect(() => {
    if (result) {
      renderLatexToCanvas(result.expression, result.answer);
    }
  }, [result, renderLatexToCanvas]);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        if (isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (isEraser) {
          erase(e);
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = color;
          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          ctx.stroke();
        }
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const runRoute = async () => {
    const canvas = canvasRef.current;

    if (canvas) {
      const response = await axios({
        method: "post",
        url: `${process.env.NEXT_PUBLIC_API_URL}/calculate`,
        data: {
          image: canvas.toDataURL("image/png"),
          dict_of_vars: dictOfVars,
        },
      });

      const resp = await response.data;
      console.log("Response", resp);
      resp.data.forEach((data: Response) => {
        if (data.assign === true) {
          setDictOfVars({
            ...dictOfVars,
            [data.expr]: data.result,
          });
        }
      });

      const ctx = canvas.getContext("2d");
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i + 3] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setLatexPosition({ x: centerX, y: centerY });
      resp.data.forEach((data: Response) => {
        setTimeout(() => {
          setResult({
            expression: data.expr,
            answer: data.result,
          });
        }, 1000);
      });
    }
  };

  const erase = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(e.nativeEvent.offsetX, e.nativeEvent.offsetY, eraserRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const updateCursorPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setCursorPosition({
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY
    });
  };

  return (
    <main className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        id='canvas'
        className='absolute inset-0 w-full h-full'
        onMouseDown={startDrawing}
        onMouseMove={(e) => {
          updateCursorPosition(e);
          draw(e);
        }}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
      />

      {isEraser && (
        <div
          className="pointer-events-none absolute border-2 border-white rounded-full opacity-50"
          style={{
            width: `${eraserRadius * 2}px`,
            height: `${eraserRadius * 2}px`,
            transform: `translate(${cursorPosition.x - eraserRadius}px, ${cursorPosition.y - eraserRadius}px)`,
            transition: 'width 0.2s, height 0.2s'
          }}
        />
      )}

      {latexExpressions.map((latex, index) => (
        <Draggable
          key={index}
          defaultPosition={latexPosition}
          onStop={(e, data) => setLatexPosition({ x: data.x, y: data.y })}
        >
          <div className="absolute p-2 text-white rounded shadow-md">
            <div className="latex-content">{latex}</div>
          </div>
        </Draggable>
      ))}

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-neutral-900 bg-opacity-80 backdrop-blur-sm border-t border-neutral-700">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setReset(true)}
                className="bg-red-600 hover:bg-red-700 text-neutral-100 font-semibold py-2 px-4 rounded-full shadow-lg transition-all duration-300"
              >
                Reset
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setIsEraser(!isEraser)}
                className={`${
                  isEraser 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-neutral-700 hover:bg-neutral-600'
                } text-neutral-100 font-semibold py-2 px-4 rounded-full shadow-lg transition-all duration-300`}
              >
                {isEraser ? 'Drawing Mode' : 'Eraser Mode'}
              </Button>
            </motion.div>

            {isEraser && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={eraserRadius}
                  onChange={(e) => setEraserRadius(Number(e.target.value))}
                  className="w-24 accent-blue-600"
                />
                <span className="text-white text-sm">{eraserRadius}px</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 justify-center flex-wrap">
            {!isEraser && SWATCHES.map((swatch: string) => (
              <motion.button
                key={swatch}
                className="w-8 h-8 rounded-full border-2 border-neutral-600 shadow-md transition-all duration-300"
                style={{ backgroundColor: swatch }}
                onClick={() => setColor(swatch)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={runRoute}
              className="bg-green-600 hover:bg-green-700 text-neutral-100 font-semibold py-2 px-4 rounded-full shadow-lg transition-all duration-300"
            >
              Run
            </Button>
          </motion.div>
        </div>
      </div>
    </main>
  );
}