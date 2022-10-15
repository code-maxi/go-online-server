import { GoServer } from "./server";

const args = process.argv

function readArg(tag: string): string | undefined {
  const tagIndex = args.indexOf('-'+tag)
  if (tagIndex === -1) return undefined
  else return args.length > tagIndex+1 ? args[tagIndex+1] : undefined
}

const server = new GoServer()
server.listen(+(readArg ? readArg : 3000))