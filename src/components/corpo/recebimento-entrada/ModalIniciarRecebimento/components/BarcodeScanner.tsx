/**
 * Componente de scanner de código de barras usando câmera
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

// Formatos de código de barras suportados em NFe
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.QR_CODE,
];

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
  isActive: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onError,
  isActive,
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [isScannerReady, setIsScannerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = useRef(`scanner-${Math.random().toString(36).substr(2, 9)}`);

  // Parar scanner e liberar câmera
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    // Limpar ref imediatamente para evitar chamadas duplicadas
    scannerRef.current = null;
    setIsScannerReady(false);

    try {
      const state = scanner.getState();
      // State 2 = SCANNING, State 3 = PAUSED
      if (state === 2 || state === 3) {
        await scanner.stop();
      }
    } catch (e) {
      // Ignorar - scanner já parado ou erro
    }

    try {
      scanner.clear();
    } catch (e) {
      // Ignorar
    }

    // Liberar todas as streams de vídeo ativas (fallback)
    try {
      const element = document.getElementById(scannerId.current);
      if (element) {
        const videos = element.querySelectorAll('video');
        videos.forEach((video) => {
          const stream = video.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            video.srcObject = null;
          }
        });
      }
    } catch (e) {
      // Ignorar
    }
  }, []);

  // Cleanup quando componente desmonta ou isActive muda para false
  useEffect(() => {
    if (!isActive) {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isActive, stopScanner]);

  // Listar câmeras
  useEffect(() => {
    if (!isActive) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label })));
          const backCamera = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('traseira') ||
              d.label.toLowerCase().includes('rear')
          );
          setSelectedCamera(backCamera?.id || devices[0].id);
        } else {
          setError('Nenhuma câmera encontrada.');
        }
      })
      .catch((err) => {
        console.error('Erro ao listar câmeras:', err);
        setError('Não foi possível acessar as câmeras. Verifique as permissões.');
      });

    return () => {
      setCameras([]);
      setSelectedCamera('');
    };
  }, [isActive]);

  // Iniciar scanner
  useEffect(() => {
    if (!isActive || !selectedCamera) return;

    let cancelled = false;

    const startScanner = async () => {
      // Parar scanner existente primeiro
      await stopScanner();

      if (cancelled) return;

      setIsStarting(true);
      setError(null);

      // Aguardar elemento estar no DOM
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (cancelled) return;

      const element = document.getElementById(scannerId.current);
      if (!element) {
        setError('Elemento do scanner não encontrado');
        setIsStarting(false);
        return;
      }

      try {
        const scanner = new Html5Qrcode(scannerId.current, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });

        if (cancelled) {
          scanner.clear();
          return;
        }

        scannerRef.current = scanner;

        await scanner.start(
          selectedCamera,
          {
            fps: 15,
            qrbox: { width: 300, height: 100 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            const numeros = decodedText.replace(/\D/g, '');
            console.log('Código detectado:', decodedText, '- Dígitos:', numeros.length);

            if (numeros.length === 44) {
              // Parar antes de chamar callback
              stopScanner().then(() => {
                onScan(numeros);
              });
            }
          },
          () => {}
        );

        if (!cancelled) {
          setIsScannerReady(true);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Erro ao iniciar scanner:', err);
        setError(err?.message || 'Erro ao iniciar câmera. Verifique as permissões.');
        onError?.(err?.message || 'Erro ao iniciar câmera');
      } finally {
        if (!cancelled) {
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [isActive, selectedCamera, onScan, onError, stopScanner]);

  const handleRetry = async () => {
    setError(null);
    await stopScanner();
    // Re-trigger selecionando a câmera novamente
    const cam = selectedCamera;
    setSelectedCamera('');
    setTimeout(() => setSelectedCamera(cam), 100);
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Seletor de câmera */}
      {cameras.length > 1 && (
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-gray-500" />
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isStarting}
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label || `Câmera ${camera.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Container do scanner */}
      <div className="relative rounded-lg overflow-hidden bg-black min-h-[220px]">
        <div id={scannerId.current} className="w-full" />

        {/* Overlay de loading */}
        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center text-white">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Iniciando câmera...</p>
            </div>
          </div>
        )}

        {/* Overlay de erro */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center text-white p-4">
              <CameraOff className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Guia de posicionamento */}
        {isScannerReady && !error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="border-2 border-emerald-400 rounded w-[280px] h-[80px] opacity-70" />
          </div>
        )}
      </div>

      {/* Instrução */}
      {isScannerReady && !error && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Posicione o código de barras da NFe dentro da área demarcada
        </p>
      )}
    </div>
  );
};

export default BarcodeScanner;
