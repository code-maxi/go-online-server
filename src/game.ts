import { emptyArray } from "./adds"
import { ClientGoGameStateI, GoMoveI, GoUser } from "./user"

export interface GoGameConfigI {
    size: number,
    firstColor: string,
    name: string,
    advance: number,
    public: boolean
}

export interface GoEndI {
    blackPoints: number,
    whitePoints: number,
    givenUpUser?: string
}

export class GoGame {
    static validateGameConfig(config: GoGameConfigI): string | undefined {
        if (config.name[0] !== '#') return "The game name has to start with a '#'."
        else if (config.name.length < 3 || config.name.length > 20) return "The length of the game name has to be in the range from 3 to 20."
        else if (!(config.firstColor === 'b' || config.firstColor === 'w')) return "The parameter firstColor must either be 'b' or 'w'."
        else if (config.size < 5 || config.size > 19) return "The board size must be in the range of 5 to 19."
        else if (config.size < 0.5 || config.size > 15.5) return "The advance must be in the range of 0.5 to 15.5."
        else return undefined
    }
    static validateUserName(name: string): string | undefined {
        if (name.length < 3 || name.length > 20) return "The length of the game name has to be in the range from 5 to 20."
        else return undefined
    }

    static FINISHED_GAME_TIMEOUT = 5000

    private users = new Map<string, GoUser>()

    private state: string[][] = []
    private turn = 'b'
    private config: GoGameConfigI

    private goEnd: GoEndI | null = null
    
    private whitePlayer: string | null = null
    private blackPlayer: string | null = null

    private passingUsers: string[] = []
    private givingUpUsers: string[] = []

    private whitePiecesCaught = 0
    private blackPiecesCaught = 0


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

    inviteUser(user: GoUser, name: string): string | undefined {
        if (user.isInitialized()) return "You have already been initialized."
        else {
            if (this.users.get(name)) return "The user name '" + name + "' does already exist."
            else {
                const nameValidation = GoGame.validateUserName(name)
                if (nameValidation) return nameValidation
                else {
                    let role: string | null = null
        
                    if (!this.blackPlayer && !this.whitePlayer) role = this.config.firstColor
                    else if (this.whitePlayer) role = this.blackPlayer
                    else if (this.blackPlayer) role = this.whitePlayer

                    user.initialize(this, name, role)
                    this.users.set(name, user)

                    console.log("User name: '" + name + "', role: '" + role + "' has successfully joined.")
                    console.log('User list: ' + JSON.stringify([...this.users.values()]))
                    console.log("______")
                    
                    return undefined
                }
            }
        }
    }

    private getGameEnd(): GoEndI {
        // TODO

        let blackPoints = 0
        let whitePoints = 0

        whitePoints += this.config.advance
        
        blackPoints += this.whitePiecesCaught
        whitePoints += this.blackPiecesCaught

        const areaPoints = this.getAreaPoints()

        blackPoints += areaPoints.blackAreaPoints
        whitePoints += areaPoints.whiteAreaPoints

        return {
            whitePoints: whitePoints,
            blackPoints: blackPoints
        }
    }

    private getAreaPoints(): { whiteAreaPoints: number, blackAreaPoints: number } {
        // TODO!!!

        return {
            whiteAreaPoints: 0,
            blackAreaPoints: 0
        }
    }

    private clientMoveGameState(): ClientGoGameStateI {
        return {
            pieces: this.state,
            turn: this.turn,
            gameName: this.config.name,
            blackPiecesCaught: this.blackPiecesCaught,
            whitePiecesCaught: this.whitePiecesCaught,
            passingPlayers: this.passingUsers,
            givingUpPlayers: this.givingUpUsers
        }
    }

    private clientUserGameState(): ClientGoGameStateI {
        return {
            viewers: [...this.users.keys()].filter(id => id !== this.blackPlayer && id !== this.whitePlayer),
            blackPlayer: this.blackPlayer,
            whitePlayer: this.whitePlayer,
            turn: this.turn,
            gameName: this.config.name
        }
    }

    private clientGameStateAllInAll(): ClientGoGameStateI {
        return {
            ...this.clientMoveGameState(),
            ...this.clientUserGameState(),
            goEnd: this.goEnd
        }
    }

    private userEndGame(givenUpUser?: string) {
        // set go end result
        this.goEnd = { ...this.getGameEnd(), givenUpUser: givenUpUser}

        // wait a little bit
        setTimeout(() => {
            this.users.forEach((user,_) => {
                user.updateGameState({
                    goEnd: this.goEnd
                })
            })
        }, GoGame.FINISHED_GAME_TIMEOUT)
    }

    userMove(move: GoMoveI, userName: string): string | undefined {
        if (this.blackPlayer && this.whitePlayer) { // if two players are in game
            if (!this.goEnd) { // if game hasn't finished yet
                if (userName === this.blackPlayer || userName === this.whitePlayer) { // if user is a player
                    if (userName === this.turn) { // If it was user's turn
                        let moveResult: string | undefined = undefined
                        
                        if (move.pos) {
                            moveResult = this.move(
                                move.pos.gridX, 
                                move.pos.gridY
                            )
                        }
                        else if (move.pass) {
                            this.passingUsers.push(userName)
                            if (this.passingUsers.length === 2) {
                                // GAME END!
                                this.userEndGame()
                            }
                        }
                        else if (move.giveup) {
                            this.givingUpUsers.push(userName)
                            if (this.givingUpUsers.length === 2) {
                                // GAME END! - this.givingUpUsers[0] has given up and looses in anyway
                                this.userEndGame(this.givingUpUsers[0])
                            }
                        }
                        else moveResult = "There must either move.pos, move.pass or move.givup be set."
    
                        if (!moveResult) {
                            if (!move.pass) this.passingUsers = []
                            if (!move.giveup) this.givingUpUsers = []

                            this.turn = this.otherColor(this.turn) // change player's turn

                            const newGameState = this.clientMoveGameState()

                            this.users.forEach((user, id) => {
                                user.updateGameState(newGameState)
                            })
                        }
                        return moveResult
                    }
                    else return 'It is not your turn to move.'
                }
                else return 'You are not allowed to do this move.'
            } 
            else return 'The game has already finished.'
        }
        else return 'There are only you in the game yet.'
    }

    move(gridX: number, gridY: number, changeTurn?: boolean): string | undefined {
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
            const caughtPieces = this.removeDeadPieces()

            this.blackPiecesCaught += caughtPieces.blackRemoved
            this.whitePiecesCaught += caughtPieces.whiteRemoved

            if (changeTurn === true) this.turn = this.otherColor(this.turn)

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