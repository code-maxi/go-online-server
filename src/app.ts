import { GoServer } from "./server";

const args = process.argv

function readArg(tag: string): string | undefined {
  const tagIndex = args.indexOf('-'+tag)
  if (tagIndex === -1) return undefined
  else return args.length > tagIndex+1 ? args[tagIndex+1] : undefined
}

const server = new GoServer()

const portArg = readArg('port')

/*server.listen(+(portArg ? portArg : 3001), +(portArg ? portArg : 3001) + 1, () => {
  server.createNewGame({
    size: 10,
    firstColor: 'b',
    name: 'test',
    advance: 4.5,
    public: true
  })
})*/

server.goLoop()