import * as readline from 'node:readline';
import express, { response } from 'express';
import { GoGame, GoGameConfigI } from './game';
import { stringToBoolean } from './adds';
import { GoUser } from './user';
import * as ws from 'ws'
import { GoGameLogic } from './game-logic';
const ip = require('ip')

export class GoServer {
    static instance: GoServer

    private app: express.Express
    private games = new Map<string, GoGame>()
    private wsServer: ws.Server

    private port: number
    private wsPort: number

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

    private getSocketURL() {
        const localIp = ip.address()
        return 'ws://' + localIp + ':' + this.wsPort + '/gosocket'
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

        this.app.use((_, res, next) => {
            res.header("Access-Control-Allow-Origin", "*")
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
            next()
        })

        this.app.get('/public-games', (_, response) => {
            response.type('text/plain')
            response.send(JSON.stringify({
                gameNames: [...this.games.values()].filter(g => g.getConfig().public).map(g => g.getConfig().name)
            }))
        })

        this.app.get('/ws-url', (_, response) => {
            const socketURl = this.getSocketURL()

            response.type('text/plain')
            response.send(socketURl)
        })

        this.app.post('/create-game', (request, response) => {
            const nameParam = request.query.name
            const sizeParam = request.query.size
            const firstColorParam = request.query.firstColor
            const advanceParam = request.query.advance
            const publicParam = stringToBoolean(request.query.public + '')

            this.log(JSON.stringify(request.query))
            this.log()

            response.type('text/plain')
            
            if (nameParam && sizeParam && firstColorParam && advanceParam && publicParam !== undefined) {
                const config = {
                    name: ''+nameParam,
                    size: +(''+sizeParam),
                    firstColor: ''+firstColorParam,
                    advance: +(''+advanceParam),
                    public: publicParam
                }

                const reponseResult = this.createNewGame(config)

                if (reponseResult) response.send('SERVERERROR:' + reponseResult)
                else response.redirect('/game/' + nameParam)
            }
            else response.send('SERVERERROR: There were not enough url parameters!')
        })
    }

    private initializeWebsocketServer(wsPort: number) {
        this.wsPort = wsPort

        this.wsServer = new ws.Server({ port: this.wsPort })

        this.wsServer.on('connection', (ws: WebSocket) => {
            new GoUser('socket', ws)
        })
        this.wsServer.on('listening', () => {
            this.log('Websocket Server is listening on port ' + this.wsPort + '.')
        })
        /*this.wsServer(this.wsPort, () => {
            this.log('HTTP Server responsible for websockets listens on port ' + this.wsPort + '.')
        })*/
    }

    log(text?: any) {
        if (text !== undefined) console.log("\x1b[33mServer logs:\x1b[0m " + text)
        else console.log()
    }

    createNewGame(config: GoGameConfigI): string | undefined {
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
        const goGame = new GoGameLogic()

        goGame.setPieces([
            [ 'b','b','b',' ',' ' ],
            [ 'b',' ','b',' ',' ' ],
            [ 'b','w','b',' ',' ' ],
            [ 'b','w','b',' ',' ' ],
            [ 'b','b','b',' ',' ' ],
        ])

        console.log('Game start pieces:')
        console.log(goGame.toString())
        console.log('____')

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        

        const ask = () => {
            rl.question('\nIt\'s ' + goGame.turn+ '\'s turn. Enter Move: \n', (data) => {
                const gridPos = (data as string).split(',').map(s => +s)
                const moveResult = goGame.move({ gridX: gridPos[0], gridY: gridPos[1] })

                if (moveResult) this.log('Error: ' + moveResult)
                else goGame.toggleTurn()
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
            size: 19,
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