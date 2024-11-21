"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback, createRef } from "react";
import axios from "axios";
import Draggable, { DraggableEvent } from "react-draggable";
import { SWATCHES } from "@/app/constants";
import { motion } from "framer-motion";
import type { GeneratedResult, LatexExpression, Response } from "@/types";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("rgb(255, 255, 255)");
  const [reset, setReset] = useState(false);
  const [dictOfVars, setDictOfVars] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GeneratedResult>();
  const [latexItems, setLatexItems] = useState<LatexExpression[]>([]);
  const [isEraser, setIsEraser] = useState(false);
  const [eraserRadius, setEraserRadius] = useState(10);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (latexItems.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub] as never);
      }, 0);
    }
  }, [latexItems]);

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexItems([]);
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

  const renderLatexToCanvas = useCallback(
    (expression: string, answer: string) => {
      const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
      setLatexItems((prev) => [
        ...prev,
        {
          content: latex,
          position: { x: 10, y: 200 },
          ref: createRef<HTMLDivElement>(),
        },
      ]);
    },
    []
  );

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
          ctx.globalCompositeOperation = "destination-out";
        } else {
          ctx.globalCompositeOperation = "source-over";
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
          ctx.globalCompositeOperation = "source-over";
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
      try {
        const response = await axios({
          method: "post",
          url: "/api/calculate",
          data: {
            image: canvas.toDataURL("image/png"),
            dict_of_vars: dictOfVars,
          },
        });

        const resp = response.data;
        console.log("Response", resp);

        if (!resp.data || resp.data.length === 0) {
          console.log("No results found");
          setResult({
            expression: "Error",
            answer: "No results found",
          });
          return;
        }

        // Process assignments first
        resp.data.forEach((data: Response) => {
          if (data.assign === true) {
            setDictOfVars((prev) => ({
              ...prev,
              [data.expr]: data.result,
            }));
          }
        });

        // Then process expressions and render each one
        resp.data.forEach((data: Response) => {
          if (!data.assign) {
            setResult({
              expression: data.expr,
              answer: data.result,
            });
            renderLatexToCanvas(data.expr, data.result);
          } else {
            // Also render variable assignments
            renderLatexToCanvas(data.expr, data.result);
          }
        });

        // Calculate position for LaTeX display
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

        // Update positions of all latex items to stack them vertically below the equation
        setLatexItems((prev) =>
          prev.map((item, i) => ({
            ...item,
            position: {
              x: (minX + maxX) / 2 - 50, // Center horizontally, offset by 50px for better visual alignment
              y: maxY + 50 + i * 40, // Position below the equation with 50px gap, stack with 40px spacing
            },
          }))
        );
      } catch (error) {
        console.error("Error calling API:", error);
        setResult({
          expression: "Error",
          answer: "Failed to process expression",
        });
      }
    }
  };

  const erase = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(
          e.nativeEvent.offsetX,
          e.nativeEvent.offsetY,
          eraserRadius,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  };

  const updateCursorPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setCursorPosition({
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
    });
  };

  const handleDrag = (
    index: number,
    e: DraggableEvent,
    data: { x: number; y: number }
  ) => {
    setLatexItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, position: { x: data.x, y: data.y } } : item
      )
    );
  };

  return (
    <main className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
      <div className="z-50 absolute top-0 left-0 right-0 p-4 bg-neutral-900 bg-opacity-80 backdrop-blur-sm border-b border-neutral-700">
        <div className="mx-auto max-w-7xl w-full flex flex-row items-center justify-between">
          <motion.h1 
            className="text-white text-xl font-bold"
            whileHover={{ scale: 1.10 }}
            whileTap={{ scale: 0.95 }}
          >
            SmartCalc
          </motion.h1>
          <motion.a
            href="https://arjuncodess.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-white underline underline-offset-4 transition-colors duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            @arjuncodess
          </motion.a>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        id="canvas"
        className="absolute inset-0 w-full h-full"
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
            transform: `translate(${cursorPosition.x - eraserRadius}px, ${
              cursorPosition.y - eraserRadius
            }px)`,
            transition: "width 0.2s, height 0.2s",
          }}
        />
      )}

      {latexItems.map((item, index) => (
        <Draggable
          key={index}
          position={item.position}
          onDrag={(e, data) => handleDrag(index, e, data)}
          bounds="parent"
          nodeRef={item.ref}
        >
          <div
            ref={item.ref}
            className="absolute p-2 text-white rounded shadow-md cursor-move"
            style={{ touchAction: "none" }}
          >
            <div className="latex-content">{item.content}</div>
          </div>
        </Draggable>
      ))}

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-neutral-900 bg-opacity-80 backdrop-blur-sm border-t border-neutral-700">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap justify-center sm:justify-start gap-3 w-full sm:w-auto">
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
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-neutral-700 hover:bg-neutral-600"
                } text-neutral-100 font-semibold py-2 px-4 rounded-full shadow-lg transition-all duration-300`}
              >
                {isEraser ? "Drawing Mode" : "Eraser Mode"}
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

          <div className="flex gap-3 justify-center flex-wrap my-2 sm:my-0">
            {!isEraser &&
              SWATCHES.map((swatch: string) => (
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

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto flex justify-center"
          >
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
