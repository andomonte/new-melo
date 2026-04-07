@echo off
echo Parando processos Node.js...
taskkill /F /IM node.exe >nul 2>&1

timeout /t 2 /nobreak >nul

echo Removendo pasta .next...
if exist .next (
    rmdir /s /q .next
    echo Pasta .next removida com sucesso!
) else (
    echo Pasta .next nao encontrada
)

echo Removendo node_modules/.cache...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo Cache do node_modules removido!
)

echo.
echo Cache limpo! Agora execute: npm run dev
echo.
pause
