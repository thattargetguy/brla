class BRLA {
    static init() {
        const container = document.getElementById("container-right"), content = document.getElementById("modal-content"), modal = content.parentNode;
        window.addEventListener("click", event => {
            if(event.target.id == "modal")
                event.target.style.display = "none";
        });
        document.form.import.addEventListener("change", async event => {
            let file = event.target.files[0], form = new FormData(document.form);
            if(!file || !/T1013_ BRLA Sheets/.test(file.name))
                return alert(`You've selected the wrong file: ${file.name}`);
            let response = await new Response(file).text();
            form.set("date", [/Begin:\s(\d{4}\-\d{2}\-\d{2})/.exec(response)[1], /End:\s(\d{4}\-\d{2}\-\d{2})/.exec(response)[1]].join(" to "));
            response = response.split(/\nExported/g)[0].split(/\n/).slice(2).filter(value => value.length > 0);
            let backrooms = this.load(response, new Map()), list = new Map();
            if(!backrooms)
                return;
            container.innerHTML = content.innerHTML = "";
            if(form.has("zigzag")) {
                let temp = `<h2>Select the backroom aisles you want to split by section:</h2><div style="font-size: 16px; margin-left: 20px; margin-top: -15px">(ex: 01B001 becomes 01B001A for sections A, C, E, etc.. and 01B001B for sections B, D, F, etc..)</div><br><form name="aisles">`;
                backrooms.forEach((aisles, backroom) => {
                    temp += `<div><span class="backroom">${backroom} Backroom</span><ul>`;
                    aisles.forEach((array, aisle) => temp += `<li><label>${aisle} <input type="checkbox" name="${aisle}" /></label></li>`);
                    temp += `</ul></div>`;
                });
                temp += `</form><br /><input type="button" id="create" value="Create" /> <input type="button" id="toggle" value="Deselect All">`;
                content.innerHTML = temp, modal.style.display = "block";
                content.querySelectorAll(".backroom").forEach(elem => {
                    elem.addEventListener("click", event => event.target.parentNode.querySelectorAll("input").forEach(input => input.checked = true));
                })
                content.querySelector("#toggle").addEventListener("click", event => document.aisles.querySelectorAll("input").forEach(input => input.checked = false));
                content.querySelector("#create").addEventListener("click", event => {
                    modal.style.display = "none", this.sort(this.parse(response, backrooms, form.has("bulk")), form);
                });
            } else
                this.sort(this.parse(response, backrooms, form.has("bulk")), form);
            event.target.value = null;
        });
    }
    static sort(backrooms, form) {
        let list = new Map(), multi = form.has("multi"), filter = "All", total = Array(12).fill(0);
        backrooms.forEach(aisles => {
            aisles.forEach((array, aisle) => {
                const brla = (1 - (array[9] / array[8])) * 100;
                if(aisle.indexOf("Backroom") != -1)
                    total = total.map((value, index) => value + (parseFloat(array[index]) || 0))
                if(multi)
                    filter = brla < 95 ? "Red" : brla < 97 ? "Yellow" : "Green"; // > 97 ? "Green" : brla > 95 ? "Yellow" : "Red";
                if(!list.has(filter))
                    list.set(filter, new Map());
                list.get(filter).set(aisle, array);
            });
        });
        let brla = (1 - (total[9] / total[8])) * 100;
        if(multi)
            filter = brla < 95 ? "Red" : brla < 97 ? "Yellow" : "Green"; // > 97 ? "Green" : brla > 95 ? "Yellow" : "Red";
        list.get(filter).set("Store BRLA", total);
        list.forEach((aisles, filter) => this.print(document.getElementById("container-right"), this.build(filter, new Map([...aisles].sort()), form)));
    }
    static load(response, backrooms) {
        response.forEach(value => {
            const array = value.replace(/\"/g, "").split(","), backroom = array[0], aisle = array.slice(0, 2).join("");
            if(backroom == "99B" || /\d{2}[CFMP]/.test(aisle))
                return;
            if(!backrooms.has(backroom))
                backrooms.set(backroom, new Map());
            backrooms.get(backroom).set(aisle, Array(12).fill(0));
        });
        return backrooms;
    }
    static parse(response, backrooms, bulk) {
        const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", form = document.aisles;
        backrooms.forEach((aisles, backroom) => backrooms.get(backroom).set(`${backroom} Backroom`, Array(12).fill(0)));
        response.forEach(value => {
            let array = value.replace(/\"/g, "").split(","), backroom = array[0], aisle = array.slice(0, 2).join(""), section = array[2];
            if(!backrooms.has(backroom))
                backrooms.set(backroom, new Map());
            if(form && form[aisle] && form[aisle].checked)
                backrooms.get(backroom).delete(aisle), aisle = `${aisle}${alpha.indexOf(section) % 2 === 0 ? "A" : "B"}`;
            const prevAisle = backrooms.get(backroom).get(aisle) || Array(12).fill(0), prevBackroom = backrooms.get(backroom).get(`${backroom} Backroom`) || Array(12).fill(0);
            backrooms.get(backroom).set(`${backroom} Backroom`, prevBackroom.map((value, index) => value + (parseFloat(array[index + 3]) || 0)));
            if(/\d{2}[CFMP]/.test(aisle) || (!bulk && backroom == "99B"))
                return;
            backrooms.get(backroom).set(aisle, prevAisle.map((value, index) => value + (parseFloat(array[index + 3]) || 0)));
        });
        return backrooms;
    }
    static draw(pdf, x, y, v1, v2, size, offset = (size / 2)) {
        if(v1 == "----" || v2 == "----")
            return this;
        if(v1 > v2)
            pdf.line(x - offset, y, x, y - (size - 0.3)).line(x, y - (size - 0.3), x + offset, y).line(x, y - size, x, y + size);
        else if(v2 > v1)
            pdf.line(x + offset, y, x, y + (size - 0.3)).line(x, y + (size - 0.3), x - offset, y).line(x, y + size, x, y - size);
        return this;
    }
    static build(brla, aisles, form) {
        const pdf = new jsPDF({ orientation: "landscape", format: "letter" }), date = form.get("date"), arrow = form.has("arrow");
        aisles.forEach((array, aisle) => {
            let [scn3, err3, baf3, gho3, scn2, err2, baf2, gho2, scn1, err1, baf1, gho1] = [...array];
            let brla3 = (1 - (err3 / scn3)) * 100, brla2 = (1 - (err2 / scn2)) * 100, brla1 = (1 - (err1 / scn1)) * 100;
            if(scn1 == 0 && err1 > 0) // This is gross, but better than -Infinity
                brla1 = (1 - ((err1 + 1) / 1)) * 100;
            if(scn2 == 0 && err2 > 0)
                brla2 = (1 - ((err2 + 1) / 1)) * 100;
            if(scn3 == 0 && err3 > 0)
                brla3 = (1 - ((err3 + 1) / 1)) * 100;
            pdf.addPage();
            pdf.setFontSize("12").text(aisle, 10, 207).text("[up/down arrows are for comparison with values from two weeks ago]", 60, 207).text(date, 219, 207);
            pdf.setLineWidth(1.5).rect(13, 13, 254, 85).setLineWidth(0.7).roundedRect(115, 115, 154, 72, 5, 5);
            pdf.setFontSize("22").text(`2 Weeks Ago: ${isFinite(brla2) ? brla2.toFixed(2) + "%" : "----"} / 3 Weeks Ago: ${isFinite(brla3) ? brla3.toFixed(2) + "%" : "----"}`, 140, 25, "center").text(help.next().value, 120, 125, { maxWidth: 140 });
            pdf.setFontSize("142").text(`${isFinite(brla1) ? brla1.toFixed(2) + "%" : "----"}`, 140, 79, "center");
            pdf.setFontSize("40").text("Scans:", 13, 130).text(`${scn1}`, 67, 130);
            pdf.setFontSize("40").text("Errors:", 13, 150).text(`${err1}`, 67, 150);
            this.draw(pdf, 62, 125, scn1, scn2, 4).draw(pdf, 62, 145, err1, err2, 4);
            if(err1 > 0)
                pdf.setFontSize("36").text(`› ${baf1} baffle${baf1 == 1 ? "" : "s"}`, 20, 170).text(`› ${gho1} ghost${gho1 == 1 ? "" : "s"}`, 20, 185);
            if(arrow)
                this.draw(pdf.setLineWidth(1.5), 32, 60, brla1, brla2, 10).draw(pdf.setLineWidth(1.5), 248, 60, brla1, brla2, 10);
        });
        return pdf.deletePage(1).setDocumentProperties({ title: `${brla} BRLA Sheets` });
    }
    static print(container, pdf) {
        const embed = document.createElement("embed"), output = pdf.output("blob");
        embed.type = "application/pdf", embed.src = URL.createObjectURL(output);
        setTimeout(() => URL.revokeObjectURL(output), 100), container.appendChild(embed);
    }
}
BRLA.init();
