import { GoEndI, GoGame } from "./game"
import { GoServer } from "./server"

export interface SendFormatI {
    header: string,
    value: any
}

export interface ClientGoGameStateI {
    boardError?: string,
    pieces?: string[][],
    viewers?: string[],
    blackPlayer?: string | null,
    blackPiecesCaught?: number,
    whitePiecesCaught?: number,
    whitePlayer?: string | null,
    passingPlayers?: string[],
    givingUpPlayers?: string[],
    turn?: string | null,
    gameName?: string,
    goEnd?: GoEndI | null,
    mySelf?: string
}

export interface GoMoveI {
    pos?: {
        gridX: number,
        gridY: number,
    }
    pass: boolean,
    giveup: boolean
}

export interface JoinGameI {
    name: string,
    gameName: string
}

export class GoUser {
    private game: GoGame
    
    private role: string | null // 'b' -> black player | 'w' -> white player | null -> viewer
    private name: string
    private initialized = false

    getRole() { return this.role }
    getName() { return this.name }

    isInitialized() { return this.initialized }

    initialize(game: GoGame, name: string, role: string) {
        this.game = game
        this.name = name
        this.role = role
        this.initialized = true
    }

    send(h: string, v: any) {
        console.log("_______")
        console.log("User's (name=" + this.name + ", role=" + this.role + ") message: ")
        console.log("    " + h)
        console.log("    " + JSON.stringify(v))
        console.log("_______")
    }

    updateGameState(state: ClientGoGameStateI) { this.send('go-game-state', { ...state, mySelf: this.name }) }

    onMessage(message: any) {

        try {
            const castedMessage = message as SendFormatI
            const h = castedMessage.header
            const v = castedMessage.value

            const wrongFormatException = () => this.send('EXC-FORM', "The value '" + JSON.stringify(v) + "' of header message '" + h + "' has the wrong format.")

            if (h === 'go-move') {
                try {
                    const casted = v as GoMoveI
                    const result = this.game.userMove(casted, this.name)
                    if (result) {
                        this.updateGameState({ boardError: result })
                    }
                }
                catch(e) { wrongFormatException() }
            }
    
            if (h === 'join-game') {
                try {
                    const casted = v as JoinGameI
    
                    let result: string | undefined = undefined
                    const game = GoServer.instance.getGame(casted.gameName)
    
                    if (game) result = game.inviteUser(this, casted.name)
                    else result = "The game '" + casted.gameName + "' does not exist."
                    
                    this.send('join-game-result', (result ? ('ERROR:' + result) : 'successfully joined'))
                }
                catch(e) { wrongFormatException() }
            }
        }
        catch (e) { this.send('EXC-FORM', "The format of any message must match {header: string, value: string} (SendFormat).") }
    }
}