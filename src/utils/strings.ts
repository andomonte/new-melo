export function incrementStringNumber(string: string): string {
    const numero: number = parseInt(string, 10) + 1;
    return String(numero).padStart(string.length, '0');
}