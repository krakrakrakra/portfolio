let feil = 0
let rik = 0
let liv = 5
let gameOver = false

const livesDiv = document.getElementById("lives")

function kl(x, boks) {
    if (gameOver) {
        return
    }

    if (x === "r") {
        document.body.style.backgroundColor = "green";
        boks.style.backgroundColor = "purple"
        boks.onclick = null
        bokser = boks.parentElement.children
        for (svar of bokser) {
             svar.onclick = null
        }

        setTimeout(() => {
            if (!gameOver) {
                document.body.style.backgroundColor = "";
            }
        }, 500);
        rik += 1
        document.getElementById("poeng").textContent = "Riktige: " + rik + " | Feil: " + feil
    }

    if (x === "f") {
        document.body.style.backgroundColor = "red";
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
                document.body.style.backgroundColor = "pink"
                document.getElementById("poeng").textContent = "Game over! Riktige: " + rik + " | Feil: " + feil
            }, 500);
        } else {
            setTimeout(() => {
                document.body.style.backgroundColor = "";
            }, 500);
        }
    }
}
