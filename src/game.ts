import { emptyArray } from "./adds"
import { ClientGoGameStateI, GoEndI, GoMoveI, GoUser } from "./user"

export interface GoGameConfigI {
    size: number,
    firstColor: string,
    name: string,
    advance: number,
    public: boolean
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
        if (name.toLowerCase().includes('waiting')) return "The name must not include 'waiting'."
        else if (name.length < 3 || name.length > 20) return "The length of the game name has to be in the range from 5 to 20."
        else return undefined
    }

    static FINISHED_GAME_TIMEOUT = 5000

    private users = new Map<string, GoUser>()
    private interestedUsers: GoUser[] = []
    private config: GoGameConfigI

    private pieces: string[][] = []
    private turn = 'b'
    
    private goEnd: GoEndI | null = null
    
    private whitePlayer: string | null = null
    private blackPlayer: string | null = null

    private passingRoles: string[] = []
    private givingUpRoles: string[] = []

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
            this.pieces.push(row)
        }
        this.log('Game initialized. Size: ' + this.pieces.length + 'x' + this.pieces[0].length)
    }

    getPiece(gridX: number, gridY: number) {
        return gridY >= 0 && gridX >= 0 && gridY < this.pieces.length && gridX < this.pieces[0].length ? this.pieces[gridY][gridX] : undefined
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

    interestedUser(user: GoUser) { this.interestedUsers.push(user) }
    uninterestUser(user: GoUser) {
        const index = this.interestedUsers.indexOf(user)
        if (index >= 0) {
            this.interestedUsers.splice(index,1)
        }
    }

    private sendUserStateToClients() {
        const userGameState = this.clientUserGameState()
        this.users.forEach((user,_) => {
            user.updateGameState(userGameState)
        })
        this.interestedUsers.forEach(user => user.updateGameState(userGameState))
    }

    log(text?: any) {
        if (text !== undefined) console.log("\x1b[36mGoGame '" + this.config.name + "' logs:\x1b[0m " + text)
        else console.log()
    }

    private newRole(): string | null {
        let role: string | null = null
        
        if (this.blackPlayer === null && this.whitePlayer === null) role = this.config.firstColor
        else if (this.whitePlayer !== null && this.blackPlayer === null) role = this.blackPlayer
        else if (this.blackPlayer !== null && this.whitePlayer === null) role = this.whitePlayer

        return role
    }

    inviteUser(user: GoUser, name: string): string | undefined {
        if (user.isInitialized()) return "You have already been initialized."
        else {
            if (this.users.get(name)) return "The user name '" + name + "' does already exist."
            else {
                const nameValidation = GoGame.validateUserName(name)
                if (nameValidation) return nameValidation
                else {
                    const newRole = this.newRole()

                    user.joinGame(this, name, newRole)
                    this.users.set(name, user)

                    if (newRole === 'w') this.whitePlayer = name
                    else if (newRole === 'b') this.blackPlayer = name

                    this.sendUserStateToClients()

                    this.log("User name: '" + name + "', role: '" + newRole + "' has successfully joined.")
                    this.log(this.blackPlayer)
                    this.log(this.whitePlayer)
                    this.log("______")
                    
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
            pieces: this.pieces,
            turn: this.turn,
            gameName: this.config.name,
            blackPiecesCaught: this.blackPiecesCaught,
            whitePiecesCaught: this.whitePiecesCaught,
            advance: this.config.advance,
            passingRoles: this.passingRoles,
            givingUpRoles: this.givingUpRoles
        }
    }

    private clientUserGameState(): ClientGoGameStateI {
        return {
            viewers: [...this.users.keys()].filter(id => id !== this.blackPlayer && id !== this.whitePlayer),
            blackPlayer: this.blackPlayer,
            whitePlayer: this.whitePlayer,
            turn: this.turn,
            gameName: this.config.name,
            futureRole: this.newRole()
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

    userMove(move: GoMoveI, userRole: string): string | undefined {
        if (this.blackPlayer && this.whitePlayer) { // if two players are in game
            if (!this.goEnd) { // if game hasn't finished yet
                if (userRole === 'w' || userRole === 'b') { // if user is a player
                    if (userRole === this.turn) { // If it was user's turn
                        let moveResult: string | undefined = undefined
                        
                        if (move.pos) {
                            moveResult = this.move(
                                move.pos.gridX, 
                                move.pos.gridY
                            )
                        }
                        else if (move.pass === true) {
                            this.passingRoles.push(userRole)
                            if (this.passingRoles.length === 2) {
                                // GAME END!
                                this.userEndGame()
                            }
                        }
                        else if (move.giveup === true) {
                            this.givingUpRoles.push(userRole)
                            if (this.givingUpRoles.length === 2) {
                                // GAME END! - this.givingUpUsers[0] has given up and looses in anyway
                                this.userEndGame(this.givingUpRoles[0])
                            }
                        }
                        else moveResult = "There must either move.pos, move.pass or move.givup be set."
    
                        if (!moveResult) {
this.log('successfully moved...')
this.log(this.toString())
this.log()
                            
                            if (move.pass !== true) this.passingRoles = []
                            if (move.giveup !== true) this.givingUpRoles = []

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
        this.log()
        this.log('Executing move ' + this.getTurn() + gridX + '_' + gridY + '!')
        this.log(this.otherColor(this.turn))
        this.log('Turn: ' + this.turn)
        
        const neighbours = this.neighbours(gridX, gridY)
        const piece = this.getPiece(gridX, gridY)
        this.log(neighbours)

        if (!piece) return 'The position (' + gridX + ' | ' + gridY + ') is out of range!'

        else if (piece !== ' ')
            return 'The position (' + gridX + ' | ' + gridY + ') is already set!'
        
        else if (neighbours.filter(p => this.otherColor(this.turn) === p).length === neighbours.length)
            return 'Suicide is not allowed!'

        else {
            this.pieces[gridY][gridX] = this.turn
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

        for (let yi = 0; yi < this.pieces.length; yi ++) {
            for (let xi = 0; xi < this.pieces[yi].length; xi ++) {
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
            this.pieces[cp.y][cp.x] = ' '
        })

        return {
            blackRemoved: blackCount,
            whiteRemoved: whiteCount
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