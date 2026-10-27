export const formatDefogTime = (value) => {
    if (value === null || value === undefined || value === '') return '00:00';
    const number = Number(value);
    if (number === 0) return '关闭';
    if (!Number.isInteger(number) || number < 1 || number > 2359 || number % 100 > 59) return '--';
    return `${String(Math.floor(number / 100)).padStart(2, '0')}:${String(number % 100).padStart(2, '0')}`;
};

export const encodeDefogTime = (time) => {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time))) return null;
    const value = Number(time.replace(':', ''));
    return value === 0 ? null : value;
};
