import { emptyArray } from "./adds"
import { GoUser } from "./user"

export interface GoGameConfigI {
    size: number,
    firstColor: string,
    name: string,
    advance: number,
    public: boolean
}
export class GoGame {
    static isGameConfigValid(config: GoGameConfigI): string | undefined {
        if (!(config.firstColor === 'b' || config.firstColor === 'w')) return "The parameter firstColor must either be 'b' or 'w'."
        if (config.size < 5 || config.size > 19) return "The board size must be in the range of 5 to 19."
        if (config.size < 0.5 || config.size > 15.5) return "The advance must be in the range of 0.5 to 15.5."
        else return undefined
    }

    private state: string[][] = []
    private turn = 'b'
    private config: GoGameConfigI
    
    private whitePlayer: string | undefined
    private blackPlayer: string | undefined
    private users = new Map<string, GoUser>()

    constructor(config: GoGameConfigI) {
        this.config = config
        this.initialize()
    }

    private initialize() {
        for (let yi = 0; yi < this.config.size; yi ++) {
            let row: string[] = []
            for (let xi = 0; xi < this.config.size; xi ++) row.push(' ')
            this.state.push(row)
        }
        console.log('Game initialized. Size: ' + this.state.length + 'x' + this.state[0].length)
    }

    getPiece(gridX: number, gridY: number) {
        return gridY >= 0 && gridX >= 0 && gridY < this.state.length && gridX < this.state[0].length ? this.state[gridY][gridX] : undefined
    }
    getTurn() { return this.turn }
    getConfig() { return this.config }

    private otherColor(c: string) { return c === 'w' ? 'b' : (c === 'b' ? 'w' : ' ') }

    private neighbours(gridX: number, gridY: number): (string | undefined)[] {
        return [
            this.getPiece(gridX, gridY-1), // top
            this.getPiece(gridX-1, gridY), // left
            this.getPiece(gridX, gridY+1), // bottom
            this.getPiece(gridX+1, gridY), // right
        ]
    }

    userMove(gridX: number, gridY: number, userName: string): string | undefined {
        if (this.blackPlayer && this.whitePlayer) {
            if (userName === this.blackPlayer || userName === this.whitePlayer) {
                if (userName === this.turn) {
                    const moveResult = this.move(gridX, gridX)
                    if (!moveResult) {
                        this.users.forEach((user, id) => {
                            
                        })
                    }
                    return moveResult
                }
                else return 'It is not your turn to move.'
            }
            else return 'You are not allowed to do this move.'
        }
        else return 'There are only you in the game yet.'
    }

    private move(gridX: number, gridY: number): string | undefined {

        console.log()
        console.log('Executing move ' + this.getTurn() + gridX + '_' + gridY + '!')
        console.log(this.otherColor(this.turn))
        console.log('Turn: ' + this.turn)
        
        const neighbours = this.neighbours(gridX, gridY)
        const piece = this.getPiece(gridX, gridY)
        console.log(neighbours)

        if (!piece) return 'The position (' + gridX + ' | ' + gridY + ') is out of range!'

        else if (piece !== ' ')
            return 'The position (' + gridX + ' | ' + gridY + ') is already set!'
        
        else if (neighbours.filter(p => this.otherColor(this.turn) === p).length === neighbours.length)
            return 'Suicide is not allowed!'

        else {
            this.state[gridY][gridX] = this.turn
            this.removeDeadPieces()

            this.turn = this.otherColor(this.turn)

            console.log()
            console.log(this.toString())
            console.log()

            return undefined
        }
    }

    private removeDeadPieces(): { blackRemoved: number, whiteRemoved: number } {
        let cleanedPositions: { x:number, y:number, p: string }[] = []
        let blackCount = 0
        let whiteCount = 0

        for (let yi = 0; yi < this.state.length; yi ++) {
            for (let xi = 0; xi < this.state[yi].length; xi ++) {
                const piece = this.getPiece(xi, yi)
                if (piece !== ' ') {
                    const neighbours = this.neighbours(xi, yi)
                    if (!neighbours.find(n => n === ' ' || n === this.getTurn())) cleanedPositions.push({x: xi, y: yi, p: piece})
                }
            }
        }

        cleanedPositions.forEach(cp => {
            if (cp.p === 'b') blackCount ++
            else if (cp.p === 'w') whiteCount ++
            this.state[cp.y][cp.x] = ' '
        })

        return {
            blackRemoved: blackCount,
            whiteRemoved: whiteCount
        }
    }

    dataToString(data: string[][]) { return data.map(item => item.join('')).join('\n') }
    stringToData(string: string) { return string.split('\n').map(item => item.split('')) }
    toString() {
        const topLine = emptyArray(this.state[0].length, () => '___').join('') + '__'
        const bottomLine = emptyArray(this.state[0].length, () => '‾‾‾').join('') + '‾‾'
        return topLine + '\n|' + this.state.map(item => item.map(i => ' '+(i === 'b' ? '●' : (i === 'w' ? '○' : '+'))+' ').join('')).join('|\n|') + '|\n' + bottomLine
    }
}