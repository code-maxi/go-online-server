export function emptyArray<T>(n: number, initialValue: (i: number) => T) {
    let res: T[] = []
    for (let i = 0; i < n; i ++) res.push(initialValue(i))
    return res
}

export function sum<T>(array: T[], numberOfValue: (v: T) => number): number {
    let result = 0
    array.forEach(v => result += numberOfValue(v))
    return result
}

export function stringToBoolean(bool: string): boolean | undefined {
    try { return JSON.parse(bool.toLowerCase()) }
    catch (e) { return undefined }
}