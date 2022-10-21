import { emptyArray } from "./adds"
import { ClientGoGameStateI, GoEndI, GoMoveI, GoUser, GridVectorI } from "./user"

export interface GoGameConfigI {
    size: number,
    firstColor: string,
    name: string,
    advance: number,
    public: boolean
}

export class GoGame {
    static validateGameConfig(config: GoGameConfigI): string | undefined {
        if (config.name.length < 3 || config.name.length > 20) return "The length of the game name has to be in the range from 3 to 20."
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

    private lastPiece: GridVectorI | undefined = undefined

    constructor(config: GoGameConfigI) {
        this.config = config
        this.initialize()
    }

    private initialize() {
        this.newGame()
        this.log('Game initialized. Size: ' + this.pieces.length + 'x' + this.pieces[0].length)
    }

    getTurn() { return this.turn }
    getConfig() { return this.config }

    interestUser(user: GoUser) {
        this.interestedUsers.push(user)
        user.updateGameState(this.clientUserGameState(true))
    }
    uninterestUser(user: GoUser) {
        const index = this.interestedUsers.indexOf(user)
        if (index >= 0) {
            this.interestedUsers.splice(index,1)
        }
    }

    private sendUserStateToClients() {
        const userGameState = this.clientUserGameState()
        const userGameStateInterested = this.clientUserGameState(true)
        
        this.users.forEach((user,_) => {
            user.updateGameState(userGameState)
        })
        this.interestedUsers.forEach(user => user.updateGameState(userGameStateInterested))
    }

    log(text?: any) {
        if (text !== undefined) console.log("\x1b[36mGoGame '" + this.config.name + "' logs:\x1b[0m " + text)
        else console.log()
    }

    private futureRole(): string | null {
        let role: string | null = null
        
        if (!this.blackPlayer && !this.whitePlayer) role = this.config.firstColor
        else if (this.whitePlayer && !this.blackPlayer) role = 'b'
        else if (this.blackPlayer && !this.whitePlayer) role = 'w'

        return role
    }

    private newGame() {
        this.pieces = []
        for (let yi = 0; yi < this.config.size; yi ++) {
            let row: string[] = []
            for (let xi = 0; xi < this.config.size; xi ++) row.push(' ')
            this.pieces.push(row)
        }
    }

    inviteUser(user: GoUser, name: string): string | undefined {
        if (user.isInitialized()) return "You have already been initialized."
        else {
            if (this.users.get(name)) return "The user name '" + name + "' does already exist."
            else {
                const nameValidation = GoGame.validateUserName(name)
                if (nameValidation) return nameValidation
                else {
                    const newRole = this.futureRole()

                    user.joinGame(this, name, newRole)
                    this.users.set(name, user)

                    if (newRole === 'w') this.whitePlayer = name
                    else if (newRole === 'b') this.blackPlayer = name

                    if (this.blackPlayer && this.whitePlayer) {
                        this.newGame()
                    }

                    user.updateGameState(this.clientGameStateAllInAll())

                    this.sendUserStateToClients()

                    setTimeout(() => {
                        this.users.forEach((userP, _) => {
                            if (userP !== user) userP.displayToasts([{
                                from: name,
                                text: "Hi there! I just joined the game.",
                                autoHide: 7000
                            }])
                        })
                    }, 500)

                    this.log("User name: '" + name + "', role: '" + newRole + "' has successfully joined.")
                    this.log(this.blackPlayer)
                    this.log(this.whitePlayer)
                    this.log("______")
                    
                    return undefined
                }
            }
        }
    }

    closeUser(user: GoUser, reason: string) {
        if (user.getName()) {
            this.users.delete(user.getName())
            if (user.getRole() === 'b') this.blackPlayer = null
            else if (user.getRole() === 'w') this.whitePlayer = null

            this.sendUserStateToClients()

            setTimeout(() => {
                this.users.forEach((user, _) => {
                    user.displayToasts([{
                        from: user.getName(),
                        text: "Bye guys! " + reason,
                        autoHide: 7000
                    }])
                })
            }, 500)
        }
        else  {
            const index = this.interestedUsers.indexOf(user)
            this.interestedUsers.splice(index, 1)
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

    private clientGoGameState(): ClientGoGameStateI {
        return {
            pieces: this.pieces,
            turn: this.turn,
            gameName: this.config.name,
            blackPiecesCaught: this.blackPiecesCaught,
            whitePiecesCaught: this.whitePiecesCaught,
            advance: this.config.advance,
            passingRoles: this.passingRoles,
            givingUpRoles: this.givingUpRoles,
            lastPiece: this.lastPiece
        }
    }

    private clientUserGameState(interesstedUser?: boolean): ClientGoGameStateI {
        return {
            viewers: [...this.users.keys()].filter(id => id !== this.blackPlayer && id !== this.whitePlayer),
            blackPlayer: this.blackPlayer,
            whitePlayer: this.whitePlayer,
            turn: interesstedUser === true ? undefined : this.turn,
            futureRole: interesstedUser === true ? this.futureRole() : undefined,
            gameName: this.config.name
        }
    }

    private clientGameStateAllInAll(): ClientGoGameStateI {
        return {
            ...this.clientGoGameState(),
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
                            moveResult = this.move(move.pos)
                            if (!moveResult) {
                                this.lastPiece = move.pos
                            }
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
                            this.log('Successfully moved...\n')
                            this.log(this.toString())
                            this.log()
                            
                            if (move.pass !== true) this.passingRoles = []
                            if (move.giveup !== true) this.givingUpRoles = []

                            this.turn = this.otherColor(this.turn) // change player's turn

                            const newGameState = this.clientGoGameState()

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

    move(move: GridVectorI, changeTurn?: boolean): string | undefined {
        this.log()
        this.log('Executing move ' + this.getTurn() + move.gridX + '_' + move.gridY + '!')
        this.log('Turn: ' + this.turn)
        
        const neighbours = this.neighbours(move.gridX, move.gridY)
        const piece = this.getPiece(move.gridX, move.gridY)

        if (!piece) return 'The position (' + move.gridX + ' | ' + move.gridY + ') is out of range!'

        else if (piece !== ' ')
            return 'The position (' + move.gridX + ' | ' + move.gridY + ') is already set!'
        
        else if (neighbours.filter(p => this.otherColor(this.turn) === p).length === neighbours.length)
            return 'Suicide is not allowed!'

        else {
            this.pieces[move.gridY][move.gridX] = this.turn
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