import { useState, useRef, useEffect } from 'react';

export function useSignatureCanvas({ currentView, printingWorker, isApproved }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [signatureSaved, setSignatureSaved] = useState(null);

    useEffect(() => {
        if (!isApproved) {
            setSignatureSaved(null);
            setHasSignature(false);
        }
    }, [isApproved]);

    useEffect(() => {
        if (currentView === 'inicio' && canvasRef.current) {
            const timer = setTimeout(() => {
                if (!canvasRef.current) return;
                const canvas = canvasRef.current;
                const parent = canvas.parentElement;
                canvas.width = parent.clientWidth;
                canvas.height = 200;
                const ctx = canvas.getContext('2d');
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#4f46e5';

                if (signatureSaved && !printingWorker) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                        setHasSignature(true);
                    };
                    img.src = signatureSaved;
                } else if (!printingWorker) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    setHasSignature(false);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [currentView, printingWorker, isApproved, signatureSaved]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e) => {
        setIsDrawing(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
        if (!hasSignature) setHasSignature(true);
    };

    const stopDrawing = () => {
        if (isDrawing && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.closePath();
            setIsDrawing(false);
        }
    };

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
        setSignatureSaved(null);
    };

    return {
        canvasRef, isDrawing, hasSignature, setHasSignature,
        signatureSaved, setSignatureSaved,
        startDrawing, draw, stopDrawing, clearCanvas,
    };
}
