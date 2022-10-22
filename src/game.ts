import { emptyArray } from "./adds"
import { GoGameLogic } from "./game-logic"
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
    
    private goEnd: GoEndI | null = null
    
    private whitePlayer: string | null = null
    private blackPlayer: string | null = null

    private passingRoles: string[] = []
    private givingUpRoles: string[] = []

    private logic: GoGameLogic

    constructor(config: GoGameConfigI) {
        this.config = config
        this.logic = new GoGameLogic((v) => this.log(v))
        this.initialize()
    }

    private initialize() {
        this.logic.newGame(this.config.size)
    }

    getTurn() { return this.logic.turn }
    getConfig() { return this.config }
    getLogic() { return this.logic }

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
                        this.logic.newGame(this.config.size)
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

    private clientGoGameState(): ClientGoGameStateI {
        return {
            pieces: this.logic.getPieces(),
            turn: this.logic.turn,
            gameName: this.config.name,
            blackPiecesCaught: this.logic.getCaughtPieces().b,
            whitePiecesCaught: this.logic.getCaughtPieces().w,
            advance: this.config.advance,
            passingRoles: this.passingRoles,
            givingUpRoles: this.givingUpRoles,
            lastPiece: this.logic.getLastPiece().pos
        }
    }

    private clientUserGameState(interesstedUser?: boolean): ClientGoGameStateI {
        return {
            viewers: [...this.users.keys()].filter(id => id !== this.blackPlayer && id !== this.whitePlayer),
            blackPlayer: this.blackPlayer,
            whitePlayer: this.whitePlayer,
            turn: interesstedUser === true ? undefined : this.logic.turn,
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
        const result = this.logic.gameEnd(this.config.advance)

        // set go end result
        this.goEnd = { blackScore: result[0], whiteScore: result[1], givenUpUser: givenUpUser}

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
                    if (userRole === this.logic.turn) { // If it was user's turn
                        let moveResult: string | undefined = undefined
                        
                        if (move.pos) {
                            moveResult = this.logic.move(move.pos)
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

                            this.logic.toggleTurn()

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
}