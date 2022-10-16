import { GoGame } from "./game"

export interface SendFormatI {
    header: string,
    value: any
}

export interface GoMoveI {
    gridX: number,
    gridY: number
}

export interface ClientGoGameStateI {
    boardError?: string
}

export class GoUser {
    private game: GoGame
    
    private role: string | null // 'b' -> black player | 'w' -> white player | null -> viewer
    private name: string

    getRole() { return this.role }
    getName() { return this.name }

    constructor(game: GoGame) {
        this.game = game
    }

    send(h: string, v: any) {
        // TODO
    }
    private onMessage(h: string, v: any) {
        const wrongFormatException = () => this.send('EXC-FORM', "The value '" + JSON.stringify(v) + "' of header message '" + h + "' has the wrong format.")
        if (h === 'go-move') {
            try {
                const casted = v as GoMoveI
                const result = this.game.userMove(casted.gridX, casted.gridY, this.name)
                if (result) this.send('go-board-error', result)
            }
            catch(e) { wrongFormatException() }
        }
    }
}