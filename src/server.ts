
import * as readline from 'node:readline';
import express from 'express';
import * as http from 'http';
import { GoGame, GoGameConfigI } from './game';
import { stringToBoolean } from './adds';
import { GoUser } from './user';
import { Console } from 'node:console';

export class GoServer {
    static instance: GoServer

    private app: express.Express
    private games = new Map<string, GoGame>()
    private wsServer: http.Server

    getGame(gameName: string) { return this.games.get(gameName) }

    constructor() {
        GoServer.instance = this
    }

    gameArray() { return [ ...this.games.values() ] }

    listen(port: number, wsPort: number, callback?: () => void) {
        this.app = express()

        this.initializeExpress()
        this.initializeWebsocketServer(wsPort)

        this.app.listen(port, () => {
            this.log("Go Server is listening on port " + port + ".")
            this.log("_______")
            this.log()
            if (callback) callback()
        })
    }

    private initializeExpress() {
        this.log('Initializing Go Server...')

        this.app.use((request, _, next) => {
            this.log('Server-HTTP-Request: ' + request.url)
            this.log(request.params)
            this.log(request.query)
            this.log(request.body)
            this.log()
            next()
        })

        this.app.get('/public-games', (_, response) => {
            response.end(JSON.stringify({
                gameNames: [...this.games.values()].filter(g => g.getConfig().public).map(g => g.getConfig().name)
            }))
        })

        this.app.post('/create-game', (request, response) => {
            const nameParam = request.query.name
            const sizeParam = request.query.size
            const firstColorParam = request.query.firstColor
            const advanceParam = request.query.advance
            const publicParam = stringToBoolean(request.query.public + '')

            this.log(nameParam)
            this.log(sizeParam)
            this.log(firstColorParam)
            this.log(advanceParam)
            this.log(publicParam)
            this.log()
            
            if (nameParam && sizeParam && firstColorParam && advanceParam && publicParam !== undefined) {
                const config = {
                    name: ''+nameParam,
                    size: +(''+sizeParam),
                    firstColor: ''+firstColorParam,
                    advance: +(''+advanceParam),
                    public: publicParam
                }

                const reponseResult = this.createNewGame(config)

                if (reponseResult) response.end('SERVERERROR:' + reponseResult)
                else response.redirect('/game/' + nameParam)
            }
            else response.end('SERVERERROR:There were not enough url parameters!')
        })
    }

    private initializeWebsocketServer(wsPort: number) {
        this.wsServer = http.createServer(this.app)

        this.wsServer.on('connection', (ws: WebSocket) => {
            new GoUser('console', ws)
        })
        this.wsServer.listen(wsPort, () => {
            this.log('HTTP Server responsible for websockets listens on port ' + wsPort + '.')
        })
    }

    log(text?: any) {
        if (text !== undefined) console.log("\x1b[33mServer logs:\x1b[0m " + text)
        else console.log()
    }

    private createNewGame(config: GoGameConfigI): string | undefined {
        if (this.games.get(config.name)) 
            return "The game name '"+config.name+"' does already exist!"

        else {
            const validation = GoGame.validateGameConfig(config)
            if (validation) return validation
            else {
                const newGame = new GoGame(config)
                this.games.set(config.name, newGame)    
                return undefined
            }
        }
    }

    goLoop() {
        const goGame = new GoGame({
            size: 5,
            firstColor: 'b',
            name: 'test',
            advance: 2.5,
            public: true
        })

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        

        const ask = () => {
            rl.question('\nIt\'s ' + goGame.getTurn()+ '\'s turn. Enter Move: \n', (data) => {
                const gridPos = (data as string).split(',').map(s => +s)
                const moveResult = goGame.move(gridPos[0], gridPos[1], true)
                if (moveResult) this.log('Error: ' + moveResult)
                ask()
            })
        }

        ask()
    }

    testUserBehavoiur() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        const emptyUsers = new Map<string, GoUser>()
        
        const creationError = this.createNewGame({
            name: '#go',
            firstColor: 'w',
            size: 5,
            advance: 0.5,
            public: true
        })

        if (creationError) this.log(creationError)

        emptyUsers.set('1', new GoUser('console'))
        emptyUsers.set('2', new GoUser('console'))

        const ask = () => {
            rl.question('\x1b[33m Input: \x1b[0m', (answer) => {
                if (answer !== 'EXIT') {
                    this.log()
                    if (answer.startsWith('CREATE ')) {
                        const id = answer.substring(7,8)
                        emptyUsers.set(id, new GoUser('console'))
                        this.log('debug user with id ' + id + ' created!')
                    }
                    else if (answer.startsWith('MESSAGE TO ')) {
                        const id = answer.substring(11,12)
                        const message = answer.substring(14).split(';')
                        try {
                            const parsedHeader = message[0]
                            const parsedValue = JSON.parse(message[1])
                            emptyUsers.get(id)?.onMessage({ header: parsedHeader, value: parsedValue })
                        }
                        catch(e) {
                            this.log('Message "' + message + '" could not be parsed.')
                        }
                    }
                    this.log()
                    ask()
                }
                else {
                    this.log("Exiting...")
                    process.exit(0)
                }
            })
        }
        
        ask()
    }
}