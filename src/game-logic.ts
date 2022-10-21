import { emptyArray, sum } from "./adds"
import { GridVectorI } from "./user"

interface StoneGroupItemI {
    pos: GridVectorI,
    freedomPoints: number,
    color: string
}

export class GoGameLogic {
    private turn: string = 'b'
    private pieces: string[][] = []
    private pieceHistory: string[][][] = []

    private piecesCaught = { w: 0, b: 0 }

    private posOnBoard(pos: GridVectorI) {
        return pos.gridY >= 0 && pos.gridX >= 0 && pos.gridY < this.pieces.length && pos.gridX < this.pieces[0].length
    }

    getPiece(pos: GridVectorI): string | undefined {
        return this.posOnBoard(pos) ? this.pieces[pos.gridY][pos.gridX] : undefined
    }

    setPiece(pos: GridVectorI, piece: string): boolean {
        const posOnBoard = this.posOnBoard(pos)
        this.pieces[pos.gridY][pos.gridX] = piece
        return posOnBoard
    }

    equalPos(p1: GridVectorI, p2: GridVectorI) {
        return p1.gridX === p2.gridX && p1.gridY === p2.gridY
    }

    private getNeighbours(pos: GridVectorI): string[] {
        return this.getNeighboursPos(pos).map(p => this.getPiece(p))
    }

    private getNeighboursPos(pos: GridVectorI): GridVectorI[] {
        return [
            {gridX: pos.gridX, gridY: pos.gridY-1}, // top
            {gridX: pos.gridX-1, gridY: pos.gridY}, // left
            {gridX: pos.gridX, gridY: pos.gridY+1}, // bottom
            {gridX: pos.gridX+1, gridY: pos.gridY}, // right
        ].filter(p => this.getPiece(p))
    }

    otherColor(c: string) { return c === 'w' ? 'b' : (c === 'b' ? 'w' : ' ') }

    private newGame(size: number) {
        this.pieceHistory = []
        this.pieces = []
        for (let yi = 0; yi < size; yi ++) {
            let row: string[] = []
            for (let xi = 0; xi < size; xi ++) row.push(' ')
            this.pieces.push(row)
        }
    }

    private stoneGroup(pos: GridVectorI, depth: number, parentPos?: GridVectorI): StoneGroupItemI[] {
        const piece = this.getPiece(pos)

        if (piece !== ' ') {
            let stoneGroup: StoneGroupItemI[] = []
            
            const neighbours = this.getNeighboursPos(pos)

            stoneGroup.push({
                freedomPoints: neighbours.filter(p => this.getPiece(p) === ' ').length,
                pos: pos,
                color: piece
            })

            neighbours
                .filter(n => this.getPiece(n) === piece && (!parentPos || !this.equalPos(parentPos, n)))
                .forEach(p => {
                    const childGroup = this.stoneGroup(p, depth + 1, pos)
                    childGroup.forEach(ci => stoneGroup.push(ci))
                })

            return stoneGroup
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

        this.iterateThroughPieces(pos => {
            const isPosAlreadyUsed = collectedStoneGroups.find(sg => sg.find(p => this.equalPos(p.pos, pos)) !== undefined)
            if (this.getPiece(pos) === color && !isPosAlreadyUsed) {
                const stoneGroup = this.stoneGroup(pos, 1)
                collectedStoneGroups.push(stoneGroup)
            }
        })

        return collectedStoneGroups
    }

    private removeAllDeadStoneGroups(color: string) {
        const stoneGroups = this.findAllStoneGroups(this.otherColor(this.turn))

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

    private move(pos: GridVectorI): string | null {
        const piece = this.getPiece(pos)
        const neighbours = this.getNeighbours(pos)

        if (!piece) return 'The position (' + pos.gridX + ' | ' + pos.gridY + ') is out of range!'

        else if (piece !== ' ')
            return 'The position (' + pos.gridX + ' | ' + pos.gridY + ') is already set!'
        
        else if (neighbours.filter(p => this.otherColor(this.turn) === p).length === neighbours.length)
            return 'Suicide is not allowed!'

        else {
            this.pieceHistory.push([ ...this.pieces.map(row => [...row]) ])
            if (this.pieceHistory.length > 2) this.pieceHistory.shift()

            this.setPiece(pos, this.turn)

            this.removeAllDeadStoneGroups(this.otherColor(this.turn))
            this.removeAllDeadStoneGroups(this.turn)

            const isHistoryLongEnough = this.pieceHistory.length >= 2
            const isKo = isHistoryLongEnough && this.dataToString(this.pieces) === this.dataToString(this.pieceHistory[this.pieceHistory.length-2])

            if (isKo) {
                this.pieces = this.copyPieceData(this.pieceHistory[this.pieceHistory.length-1])
                return 'You can not do this move because this would cause "Ko".'
            }
            else {
                return undefined
            }
        }
    }

    dataToString(data: string[][]) { return data.map(item => item.join('')).join('\n') }
    stringToData(string: string) { return string.split('\n').map(item => item.split('')) }

    toString() {
        const topLine = emptyArray(this.pieces[0].length, () => '___').join('') + '__'
        const bottomLine = emptyArray(this.pieces[0].length, () => '‾‾‾').join('') + '‾‾'
        return topLine + '\n|' + this.pieces.map(item => item.map(i => ' '+(i === 'b' ? '●' : (i === 'w' ? '○' : '+'))+' ').join('')).join('|\n|') + '|\n' + bottomLine
    }
}