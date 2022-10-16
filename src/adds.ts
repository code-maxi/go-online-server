export function emptyArray<T>(n: number, initialValue: (i: number) => T) {
    let res: T[] = []
    for (let i = 0; i < n; i ++) res.push(initialValue(i))
    return res
}

export function stringToBoolean(bool: string): boolean | undefined {
    try { return JSON.parse(bool.toLowerCase()) }
    catch (e) { return undefined }
}