import express from 'express';

export class GoServer {
    app = express()

    listen(port: number) {
        this.app.listen(port, () => {
            console.log("Go Server is listening on port " + port + ".")
        })
    }
}