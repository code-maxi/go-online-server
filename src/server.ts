import * as readline from 'node:readline';
import express from 'express';
import { GoGame, GoGameConfigI } from './game';
import { stringToBoolean } from './adds';

export class GoServer {
    static instance: GoServer

    private app: express.Express
    private games = new Map<string, GoGame>()

    getGame(gameName: string) { return this.games.get(gameName) }

    constructor() {
        GoServer.instance = this
    }

    gameArray() { return [ ...this.games.values() ] }

    listen(port: number) {
        this.app = express()
        this.initializeExpress()
        this.app.listen(port, () => {
            console.log("Go Server is listening on port " + port + ".")
        })
    }

    private initializeExpress() {
        console.log('Initializing Go Server...')

        this.app.use((request, _, next) => {
            console.log('Server-HTTP-Request: ' + request.url)
            console.log(request.params)
            console.log(request.query)
            console.log(request.body)
            console.log()
            next()
        })

        this.app.get('/public-games', (_, response) => {
            response.end(JSON.stringify({
                gameNames: [...this.games.values()].filter(g => g.getConfig().public).map(g => g.getConfig().name)
            }))
        })

        this.app.post('/create-game', (request, response) => {
            const nameParam = request.query.name + ''
            const sizeParam = +(request.query.size + '')
            const firstColorParam = (request.query.firstColor + '')
            const advanceParam = +(request.query.advance + '')
            const publicParam = stringToBoolean(request.query.public + '')
            
            if (nameParam && sizeParam && firstColorParam && advanceParam) {
                const config = {
                    name: nameParam,
                    size: sizeParam,
                    firstColor: firstColorParam,
                    advance: advanceParam,
                    public: publicParam
                }

                const reponseResult = this.createNewGalaxy(config)

                if (reponseResult) response.end('SERVERERROR:' + reponseResult)
                else response.redirect('/game/' + nameParam)
            }
            else response.end('SERVERERROR:There were not enough url parameters!')
        })
    }

    private createNewGalaxy(config: GoGameConfigI): string | undefined {
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
                if (moveResult) console.log('Error: ' + moveResult)
                ask()
            })
        }

        ask()
    }
}