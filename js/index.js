let feil = 0
let rik = 0
let liv = 5
let gameOver = false

const livesDiv = document.getElementById("lives")
const rootStyle = document.documentElement.style

function kl(x, boks) {
    if (gameOver) {
        return
    }

    if (x === "r") {
        rootStyle.setProperty("--page-background", "green");
        boks.style.backgroundColor = "purple"
        boks.onclick = null
        bokser = boks.parentElement.children
        for (svar of bokser) {
            svar.onclick = null
        }

        setTimeout(() => {
            if (!gameOver) {
                rootStyle.removeProperty("--page-background");
            }
        }, 500);
        rik += 1
        document.getElementById("poeng").textContent = "Riktige: " + rik + " | Feil: " + feil
    }

    if (x === "f") {
        rootStyle.setProperty("--page-background", "red");
        boks.style.backgroundColor = "blue"
        boks.onclick = null

        feil += 1
        liv -= 1
        document.getElementById("poeng").textContent = "Riktige: " + rik + " | Feil: " + feil
        if (livesDiv.children.length > 0) {
            livesDiv.children[0].remove()
        }

        if (liv <= 0) {
            gameOver = true
            setTimeout(() => {
                rootStyle.setProperty("--page-background", "pink")
                document.getElementById("poeng").textContent = "Game over! Riktige: " + rik + " | Feil: " + feil
            }, 500);
        } else {
            setTimeout(() => {
                rootStyle.removeProperty("--page-background");
            }, 500);
        }
    }
}


function sf(boks) {
    rootStyle.setProperty("--page-background", "white")
    rootStyle.setProperty("--heart-color", "black")
    boks.style.color = "black"

}