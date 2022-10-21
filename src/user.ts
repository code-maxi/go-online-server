import { GoGame } from "./game"
import { GoServer } from "./server"

export interface InterestIntoGameI {
    gameName: string
}

export interface GoToastI {
    from: string,
    text: string,
    autoHide?: number
}

export interface SendFormatI {
    header: string,
    value: any
}

export interface GoEndI {
    blackPoints: number,
    whitePoints: number,
    givenUpUser?: string
}

export interface ClientGoGameStateI {
    boardError?: string,
    pieces?: string[][],
    viewers?: string[],
    blackPlayer?: string | null,
    blackPiecesCaught?: number,
    whitePiecesCaught?: number,
    whitePlayer?: string | null,
    passingRoles?: string[],
    givingUpRoles?: string[],
    turn?: string | null,
    gameName?: string,
    goEnd?: GoEndI | null,
    myRole?: string | null
    myName?: string,
    boardSize?: number,
    boardIntersectionPoints?: { x:number, y:number }[],
    advance?: number,
    guiMode?: 'join-mode' | 'game-mode',
    joinError?: string,
    gameDoesNotExistError?: string,
    futureRole?: string
}

export interface InterestIntoGameI {
    gameName: string
}

export interface GoMoveI {
    pos?: {
        gridX: number,
        gridY: number,
    }
    pass?: boolean,
    giveup?: boolean
}

export interface JoinInterestedGameI {
    name: string
}

export interface ResponseResultI {
    successful: boolean
    errorText?: string
}

export class GoUser {
    private game: GoGame
    
    private role: string | null // 'b' -> black player | 'w' -> white player | null -> viewer
    private name: string
    private initialized = false

    private medium: 'socket' | 'console'
    private interestedGame: string | undefined = undefined

    private webSocket: WebSocket

    constructor(medium?: 'socket' | 'console', webSocket?: WebSocket) {
        this.medium = medium ? medium : 'console'
        
        if (medium === 'socket') {
            this.webSocket = webSocket
            this.initializeWebSocket()
        }
    }

    displayToasts(toasts: GoToastI[]) {
        this.send('display-toasts', toasts)
    }

    private initializeWebSocket() {
        this.log('User created. Initializing web socket...')

        this.webSocket.onmessage = (ev) => {
            try {
                const data = JSON.parse(''+ev.data) as SendFormatI
                this.onMessage(data)
            }
            catch (e) { this.log('Format Exception: The format of the message "' + ev.data + '" could not be parsed as SendFormatI.') }
        }

        this.webSocket.onclose = (ev) => {
            this.log('Closed. Reason: "' + ev.reason + '"')

            if (this.game) { this.game.closeUser(this, ev.reason) }
            else if (this.interestedGame) { GoServer.instance.getGame(this.interestedGame).closeUser(this, ev.reason) }
        }

        this.webSocket.onopen = (_) => {
            this.log('Websocket successfully opened!')
        }

        this.webSocket.onerror = (_) => {
            this.log('WEBSOCKET ERROR!')
        }
    }

    log(text?: any) {
        if (text !== undefined) console.log("\x1b[31mUser (name=" + this.name +"|role="+ this.role + "):\x1b[0m " + text)
        else console.log()
    }

    getRole() { return this.role }
    getName() { return this.name }

    isInitialized() { return this.initialized }

    joinGame(game: GoGame, name: string, role: string) {
        this.game = game
        this.name = name
        this.role = role
        this.initialized = true
    }

    send(h: string, v: any) {
        if (this.medium === 'console') {
            console.log("_______")
            console.log("User's (name=" + this.name + ", role=" + this.role + ") message: ")
            console.log("    " + h)
            console.log("    " + JSON.stringify(v))
            console.log("_______")
        }
        else {
            const message = JSON.stringify({ header: h, value: v })
            this.log('Sending message ' + message)
            this.webSocket.send(message)
        }
    }

    updateGameState(state: ClientGoGameStateI) {
        const clientGameState: ClientGoGameStateI = {
            ...state, 
            myName: this.name,
            myRole: this.role
        }
        this.send('go-game-state', clientGameState)
    }

    onMessage(message: any) {
        try {
            const castedMessage = message as SendFormatI
            const h = castedMessage.header
            const v = castedMessage.value

            this.log('recieving message width header "' + h + '":')
            this.log(JSON.stringify(v))
            this.log()

            const wrongFormatException = () => this.send('EXC-FORM', "The value '" + JSON.stringify(v) + "' of header message '" + h + "' has the wrong format.")

            if (h === 'go-move') {
                try {
                    const casted = v as GoMoveI
                    const moveError = this.game.userMove(casted, this.role)
                    if (moveError) {
                        this.log('Move Error: ' + moveError)
                        this.updateGameState({ boardError: moveError })
                    }
                }
                catch(e) { wrongFormatException() }
            }
    
            else if (h === 'join-game') {
                try {
                    const casted = v as JoinInterestedGameI
    
                    let joiningError: string | undefined = this.interestedGame ? undefined : "You have not interested yet."

                    if (!joiningError) {
                        const game = GoServer.instance.getGame(this.interestedGame)
    
                        if (game) joiningError = game.inviteUser(this, casted.name)
                        else joiningError = "The game '" + this.interestedGame + "' you was interested in does not exist anymore."
                    }
                    
                    if (!joiningError) this.send('successfully-joined', null)

                    this.updateGameState({
                        guiMode: joiningError ? undefined : 'game-mode',
                        joinError: joiningError ? joiningError : undefined
                    })
                }
                catch(e) { wrongFormatException() }
            }

            else if (h === 'interested-into-game') {
                try {
                    const casted = v as InterestIntoGameI
                    this.log('Interessted into Game ' + casted.gameName)
    
                    const game = GoServer.instance.getGame(casted.gameName)

                    if (game) {
                        this.interestedGame = casted.gameName

                        if (this.interestedGame) game.uninterestUser(this)
                        game.interestUser(this)

                        this.send('successfully-interessted', null)
                    }

                    this.updateGameState({
                        gameDoesNotExistError: game ? undefined : casted.gameName
                    })
                }
                catch(e) { wrongFormatException() }
            }
        }
        catch (e) {
            this.send('EXC-FORM', "The format of any message must match {header: string, value: string} (SendFormat).")
        }
    }
}