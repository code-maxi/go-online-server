export interface GoGameConfigI {
    size: number,
    firstColor: string
}
export class GoGame {
    state: string[][]
    turn: string

    getPos(gridX: number, gridY: number) {
        return gridY < this.state.length ? (gridX < this.state[0].length ? this.state[gridY][gridX] : undefined) : undefined
    }
    private otherColor(c: string) { return c === 'w' ? 'b' : (c === 'b' ? 'w' : ' ') }

    private neighbours(gridX: number, gridY: number): (string | undefined)[] {
        return [
            this.getPos(gridX, gridY-1), // top
            this.getPos(gridX-1, gridY), // left
            this.getPos(gridX, gridY+1), // bottom
            this.getPos(gridX+1, gridY), // right
        ]
    }

    move(gridX: number, gridY: number): string | undefined {
        const neighbours = this.neighbours(gridX, gridY)

        if (this.state[gridY][gridY] !== ' ')
            return 'The position (' + gridX + ' | ' + gridY + ') is already set!'
        
        else if (neighbours.filter(p => this.otherColor(this.turn)).length === neighbours.length)
            return 'Suicide is not allowed!'

        else {
            this.state[gridY][gridX] = this.turn
            this.removeDeadPieces()
        }
    }

    private removeDeadPieces() {
        let cleanedPositions: { x:number, y:number }[] = []
        for (let yi = 0; yi < this.state.length; yi ++) {
            for (let xi = 0; xi < this.state[yi].length; xi ++) {
                const neighbours = this.neighbours(xi, yi)
                if (!neighbours.find(n => n === ' ')) cleanedPositions.push({x: xi, y: yi})
            }
        }
        cleanedPositions.forEach(cp => {
            this.state[cp.y][cp.y] = ' '
        })
    }

    dataToString(data: string[][]) { return data.map(item => item.join('')).join('\n') }
    stringToData(string: string) { return string.split('\n').map(item => item.split('')) }
}