import { emptyArray, sum } from "./adds"
import { GoEndI, GridVectorI } from "./user"

interface StoneGroupItemI {
    pos: GridVectorI,
    freedomPoints: number,
    color: string,
    freedomFields: GridVectorI[]
}

interface StoneMoveI {
    pos: GridVectorI,
    color: string
}

export class GoGameLogic {
    turn: string = 'b'

    private pieces: string[][] = []
    private pieceHistory: string[][][] = []
    private moveHistory: StoneMoveI[] = []
    private log: (v: any) => void

    constructor(log?: (v: any) => void) {
        this.log = log ? log : (v) => console.log(v)
    }

    private piecesCaught = { w: 0, b: 0 }

    private posOnBoard(pos: GridVectorI) {
        return pos.gridY >= 0 && pos.gridX >= 0 && pos.gridY < this.pieces.length && pos.gridX < this.pieces[0].length
    }

    toggleTurn() { this.turn = this.otherColor(this.turn) }

    getCaughtPieces() { return this.piecesCaught }
    getPieces() { return this.pieces }
    getLastPiece() { return this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length-1] : undefined }
    setPieces(data: string[][]) { this.pieces = data }

    getPiece(pos: GridVectorI): string | undefined {
        return this.posOnBoard(pos) ? this.pieces[pos.gridY][pos.gridX] : undefined
    }

    private setPiece(pos: GridVectorI, piece: string): boolean {
        const posOnBoard = this.posOnBoard(pos)
        this.pieces[pos.gridY][pos.gridX] = piece
        return posOnBoard
    }

    equalPos(p1: GridVectorI, p2: GridVectorI) {
        return p1.gridX === p2.gridX && p1.gridY === p2.gridY
    }

    private getNeighbours(pos: GridVectorI): GridVectorI[] {
        return [
            {gridX: pos.gridX, gridY: pos.gridY-1}, // top
            {gridX: pos.gridX-1, gridY: pos.gridY}, // left
            {gridX: pos.gridX, gridY: pos.gridY+1}, // bottom
            {gridX: pos.gridX+1, gridY: pos.gridY}, // right
        ].filter(p => this.getPiece(p) !== undefined)
    }

    otherColor(c: string) { return c === 'w' ? 'b' : (c === 'b' ? 'w' : ' ') }

    newGame(size: number) {
        this.pieceHistory = []
        this.pieces = []
        for (let yi = 0; yi < size; yi ++) {
            let row: string[] = []
            for (let xi = 0; xi < size; xi ++) row.push(' ')
            this.pieces.push(row)
        }
        this.log('Game initialized. Size: ' + this.pieces.length + 'x' + this.pieces[0].length)
    }

    gameEnd(advance: number): [number, number] {
        let bScore = 0
        let wScore = advance

        bScore += this.piecesCaught.b
        wScore += this.piecesCaught.w

        bScore += this.getAreaPoints('b')
        wScore += this.getAreaPoints('w')

        return [bScore, wScore]
    }

    private getAreaPoints(color: string): number {
        // todo
        return -1
    }

    gridVectorToString(pos: GridVectorI) {
        return '(' + pos.gridX + '|' + pos.gridY + ')'
    }

    private stoneGroup(currentPos: GridVectorI, depth: number, forbiddenPositions: GridVectorI[]): StoneGroupItemI[] {
        const piece = this.getPiece(currentPos)

        if (piece !== ' ' && depth <= 100) {
            let stoneGroup: StoneGroupItemI[] = []
            
            const neighbours = this.getNeighbours(currentPos)
            const freedomPoints = neighbours.filter(p => this.getPiece(p) === ' ')

            stoneGroup.push({
                freedomPoints: freedomPoints.length,
                freedomFields: freedomPoints,
                pos: currentPos,
                color: piece
            })

            const forbiddenNeighbours = neighbours.filter(neighbourPos => this.getPiece(neighbourPos) === piece && !forbiddenPositions.find(parentPos => this.equalPos(neighbourPos, parentPos)))
            
            forbiddenNeighbours.forEach(neighbourPos => {
                const childGroup = this.stoneGroup(
                    neighbourPos, depth + 1, 
                    [
                        ...forbiddenPositions, 
                        ...forbiddenNeighbours.filter(n => !this.equalPos(neighbourPos, n)), 
                        currentPos
                    ]
                )
                childGroup.forEach(ci => stoneGroup.push(ci))
            })

            let stoneGroup2: StoneGroupItemI[] = []

            if (depth === 0) {
                // remove same foundings
                let usedStoneGroupItems: string[] = []
                let usedFreeFields: string[] = []
                stoneGroup.forEach(sgi => {
                    const stringPos = this.gridVectorToString(sgi.pos)
                    if (!usedStoneGroupItems.includes(stringPos)) {
                        const newFreedomFields = sgi.freedomFields
                            .filter(ff => !usedFreeFields.includes(this.gridVectorToString(ff)))

                        stoneGroup2.push({
                            ...sgi,
                            freedomFields: newFreedomFields,
                            freedomPoints: newFreedomFields.length                            
                        })
                        usedStoneGroupItems.push(stringPos)

                        sgi.freedomFields.forEach(ff => {
                            const stringFF = this.gridVectorToString(ff)
                            if (!usedFreeFields.includes(stringFF)) {
                                usedFreeFields.push(stringFF)
                            }
                        })
                    }
                })
            }

            return depth === 0 ? stoneGroup2 : stoneGroup
        }
        else return []
    }

    private iterateThroughPieces(forEach: (pos: GridVectorI) => void) {
        for (let y = 0; y < this.pieces.length; y ++) {
            for (let x = 0; x < this.pieces[y].length; x ++) {
                forEach({ gridX: x, gridY: y })
            }
        }
    }

    private findAllStoneGroups(color: string): StoneGroupItemI[][] {
        let collectedStoneGroups: StoneGroupItemI[][] = []
        let checkedPositions: GridVectorI[] = []

        this.iterateThroughPieces(pos => {
            const isPosUsable = !checkedPositions.find(p => this.equalPos(p, pos))
            if (this.getPiece(pos) === color && isPosUsable) {
                const stoneGroup = this.stoneGroup(pos, 0, [])

                collectedStoneGroups.push(stoneGroup)
                stoneGroup.forEach(sgi => checkedPositions.push(sgi.pos))
            }
        })

        return collectedStoneGroups
    }

    private removeAllDeadStoneGroups(color: string) {
        this.log("Finding Stone Groups of color '"+color+"'...\n")
        const stoneGroups = this.findAllStoneGroups(this.otherColor(this.turn))

        this.log(stoneGroups.length)
        this.log(stoneGroups.map(sg => this.stoneGroupToString(sg)).join('\n;\n'))
        this.log('_____________')

        stoneGroups
            .filter(sg => sum(sg, sgi => sgi.freedomPoints) === 0)
            .forEach(sg => {
                sg.forEach(sgi => this.setPiece(sgi.pos, ' '))
                this.piecesCaught[color] = this.piecesCaught[color] + sg.length
            })
    }

    private copyPieceData(data: string[][]) {
        return [...data.map(row => [...row])]
    }

    private stoneGroupToString(sg: StoneGroupItemI[]) {
        const result: string[][] = []

        for (let yi = 0; yi < 5; yi ++) {
            let row: string[] = []

            for (let xi = 0; xi < this.pieces[yi].length; xi ++) {
                const sgi = sg.find(sgi => sgi.pos.gridX === xi && sgi.pos.gridY === yi)
                row.push(sgi ? sgi.color : ' ')
            }
            result.push(row)
        }
        return this.toString(result, '\x1b[33m') + '\nfreedom points: ' + sum(sg, sgi => sgi.freedomPoints)
    }

    move(pos: GridVectorI): string | null {
        const piece = this.getPiece(pos)

        if (!piece) return 'The position (' + pos.gridX + ' | ' + pos.gridY + ') is out of range!'

        else if (piece !== ' ')
            return 'The position (' + pos.gridX + ' | ' + pos.gridY + ') is already set!'

        else {
            this.pieceHistory.push([ ...this.pieces.map(row => [...row]) ])
            if (this.pieceHistory.length > 2) this.pieceHistory.shift()

            this.log('Go Move!')
            this.log('History:\n')
            this.log(this.pieceHistory.map(ph => this.toString(ph) + '\n'))

            this.setPiece(pos, this.turn)

            this.log('_____')
            this.log('Game state before removing: ')
            this.log(this.toString())
            this.log('_____')

            this.removeAllDeadStoneGroups(this.otherColor(this.turn))

            this.log('_____')
            this.log('Game state after removing: ')
            this.log(this.toString())
            this.log('_____')
        
            const myStoneGroup = this.stoneGroup(pos, 0, [])

            this.log('_____')
            this.log('My stone group: ')
            this.log(this.stoneGroupToString(myStoneGroup))
            this.log('Free fields: ' + myStoneGroup.filter(sgi => sgi.freedomPoints > 0).map(sgi => this.gridVectorToString(sgi.pos) + ';' + sgi.freedomPoints).join('    '))
            this.log('_____')

            const isSuicide = sum(myStoneGroup, (sgi) => sgi.freedomPoints) === 0
            const isHistoryLongEnough = this.pieceHistory.length >= 2
            const isKo = isHistoryLongEnough && this.dataToString(this.pieces) === this.dataToString(this.pieceHistory[this.pieceHistory.length-2])

            this.log('Is Suicide? ' + isSuicide)
            this.log('Is Ko? ' + isKo)

            const reset = () => this.pieces = this.copyPieceData(this.pieceHistory[this.pieceHistory.length-1])

            if (isKo) {
                reset()
                return 'You can not do this move because this would cause "Ko".'
            }
            else if (isSuicide) {
                reset()
                return 'Suicide is not allowed.'
            }
            else {
                this.moveHistory.push({
                    pos: pos,
                    color: this.turn
                })
                return undefined
            }
        }
    }

    dataToString(data: string[][]) { return data.map(item => item.join('')).join('\n') }
    stringToData(string: string) { return string.split('\n').map(item => item.split('')) }

    toString(dataP?: string[][], color?: string) {
        const data = dataP ? dataP : this.pieces
        const topLine = emptyArray(data[0].length, () => '___').join('') + '__'
        const bottomLine = emptyArray(data[0].length, () => '‾‾‾').join('') + '‾‾'

        return (color ? color : '\x1b[32m') + topLine + '\n|' + data.map(item => item.map(i => ' '+(i === 'b' ? '○' : (i === 'w' ? '●' : '+'))+' ').join('')).join('|\n|') + '|\n' + bottomLine + '\x1b[0m'
    }
}