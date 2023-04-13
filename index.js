// Importazioni delle varie librerie
const { Web } = require('classeviva.js');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();

// Numero di telefono a cui inviare gli sms N.B. è solo un numero.. non ho messo più numeri :( )
const perme = "0039xxxxxxxxxx";
// Credenziali per accedere a spaggiari :)
const codice_studente = "Sxxxxxxxy";
const password = "xxxxxxxxxx";
// Io uso traccar per gli sms, basta scaricare l'app da android o ios(non so se c'è)
const token_sms = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
// Tempo di check
const minuti_controllo = 5;

// Alcune impostazioni della libreria classeviva.js
const classeviva = new Web({
    uid: codice_studente,
    pwd: password,
    cid: 'CUSTOMERID', //OPTIONAL
    pin: 'PIN', //OPTIONAL
    target: 'TARGET' //OPTIONAL
});

// Funzione per poter inviare il SMS, con il sistema anti 160 caratteri degli sms
function inviaMessaggio(messaggio, a) {
    const apiKey = token_sms;
    const mobileIp = 'https://www.traccar.org/sms/';
    const messages = messaggio.toString().match(/.{1,160}/g);

    // N.B. ho inserito un sistema di wait per un secondo, in modo da inviare gli sms con calma senza mandarli in asincrono :)
    messages.forEach((messageDiviso, index) => {
        setTimeout(() => {
            fetch(mobileIp, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': apiKey
                    },
                    body: JSON.stringify({
                        to: a,
                        message: messageDiviso
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.responses[0].success == true) {
                        console.log(`Messaggio inviato correttamente: ${messageDiviso}`);
                    } else {
                        console.log(`Errore durante l'invio del messaggio: ${data}`);
                    }
                })
                .catch(error => console.log(error));
        }, index * 1000); // il tempo di riposo sarà di 1 secondo per ogni messaggio inviato
    });
}


const run = async () => {
    // Qui ti logga :)
    await classeviva.login();
    console.log("Loggato :D")

    console.log("Sto controllando se ci sono novità :p");
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    
    const formatDate = (date) => {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const todayString = formatDate(today);
    const nextMonthString = formatDate(nextMonth);
    // Il sistema è semplice: estrarre l'agenda in formato XML di un certo periodo
    // (1 mese), per poi farla analizzare dal programma ed estrarre i vari compiti/note
    console.log("Periodo di controllo:", todayString, nextMonthString);
    
    classeviva.exportXmlAgenda(new Date(todayString), new Date(nextMonthString))
        .then((xml) => {
            let agendastudente = xml;
            parser.parseString(agendastudente, function (err, result) {
                if (err) throw new Error('Errore nel parsing del XML');
                const rowArray = result.Workbook.Worksheet[0].Table[0].Row;
                const dataToSend = [];

                for (let i = 1; i < rowArray.length; i++) {
                    // All'interno di questo ciclo avviene il controllo dei vari compiti/note
                    const cellArray = result.Workbook.Worksheet[0].Table[0].Row[i].Cell;
                    const ora = cellArray[3].Data[0]._;
                    const giorn = cellArray[1].Data[0]._;
                    const materia = cellArray[13].Data[0]._ || 'che ne so';
                    const prof = cellArray[7].Data[0]._;
                    const compiti = cellArray[12].Data[0]._;
                    const data = cellArray[10].Data[0];
                    const cosacompiti = data && data._ ? data._.replace(/\s+/g, ' ') : '';
                    const inserimento_ora = cellArray[6].Data[0]._;
                    
                    // Vari calcoli per l'orario
                    const now = Date.now();     // Qui prende il timestamp in millisecondi del preciso istante
                    let timeinserimento = Date.parse(inserimento_ora); // Prende il timestamp in millisecondi del preciso istate dell'inserimento
                    const differenz = (now - timeinserimento)/1000; // la differenza tra gli orari dividendo per mille 
                    const minutipercontrollo = minuti_controllo*60; // prodotto tra minuti e 60 visto che il timestamp si basa così
                    var timestampInMinuti = Math.round((now - timeinserimento) / 60000); // il tempo passato in minuti
                    
                    //console.log(now+" | "+timeinserimento+" dif: "+differenz+" passato: "+timestampInMinuti);
                    
                    /* Vecchio codice V. 1.0
                    - Rimosso per problemi con Linux/Ubuntu 20.04 -> a quanto pare non sa usare i numeri.. eh vabbè.. succede :D
                    // converti la stringa in un oggetto Date
                    const data_inserimento = new Date(inserimento_ora);

                    // calcola la differenza tra l'ora corrente e quella di inserimento in millisecondi
                    const differenza_in_millisecondi = new Date() - data_inserimento;

                    // converti i millisecondi in minuti
                    const minuti_trascorsi = Math.floor(differenza_in_millisecondi / 60000);
                    //console.log("minuti_trascorsi: "+minuti_trascorsi+"\nminuti_controllo: "+minuti_controllo);
                    */

                    // Doppia condizione per evitare problemi
                    // Il primo usa il timestamp UNIX
                    // Il secondo usa il varie formule e controllare se effettivamente i minuti coincidono
                    if (differenz < minutipercontrollo && timestampInMinuti < minuti_controllo) {
                        let lora = 'non ricordo l\'orario'; // Valore predefinito, speriamo sti professori sappiano mettere gli orari :p

                        if (ora === '08:00:00') lora = '1';
                        else if (ora === '09:00:00') lora = '2';
                        else if (ora === '10:00:00') lora = '3';
                        else if (ora === '11:00:00') lora = '4';
                        else if (ora === '12:00:00') lora = '5';
                        else if (ora === '13:00:00') lora = '6';
                        else if (ora === '') lora = 'ah';

                        let messaggio = '';

                        if (compiti === 'compiti') {
                            messaggio = `Hai compiti per il *${giorn}* in *${lora}* ora, ovvero *${materia}* con *${prof}* che ti ha dato *${cosacompiti}* e li ha inseriti *${timestampInMinuti} minuti fa*`;
                        } else if (compiti === 'nota') {
                            if (lora === 'ah') {
                                messaggio = `Beh ti devo dire che hai un\'annotazione il *${giorn}* per *${cosacompiti}* con *${prof}* e l\'ha inserito *${timestampInMinuti} minuti fa*`;
                            } else {
                                messaggio = `In ogni caso il *${giorn}* in *${lora}* ora hai *${cosacompiti}* con *${prof}* e l\'ha inserito *${timestampInMinuti} minuti fa*`;
                            }
                        }
                        
                        dataToSend.push(messaggio);
                    }
                }

                /* Vecchio codice V. 1.0
                - Rimosso per rendere il codice più fluido
                if (dataToSend != '') {
                    
                    console.log('Messaggi da inviare:', dataToSend);
                    inviaMessaggio(dataToSend, perme);
                }*/
                if (dataToSend.length > 0) {
                    // Se cè qualcosa da inviare, chiama la funzione per farlo XD
                    console.log('Messaggi da inviare:', dataToSend);
                    inviaMessaggio(dataToSend.join('\n'), perme);
                } else {
                    console.log("Nessuna novità trovata");
                }

                // chiudiamo la sessione di classeviva, perché sennò arrivano a casa :)
                classeviva.logout(); // Spostato dalla versione 1.0 perchè essendo in asincrono, faceva logout prima di controllare.. e quindi è meglio fare in questo modo :)
                console.log("Logout Effettuato");
            });
        })
        /* Vecchio codice V. 1.0
        - Rimosso per prendere le promesse in modo corretto XD
        .catch((err) => {
            console.error(err); // Speriamo non accada nulla di speciale LOL
        });*/
        .catch((error) => {
            console.log("Errore nella promessa:", error);
        });


};

// eseguiamo la funzione run una volta all'avvio
run();

// eseguiamo la funzione run ogni minuti_controllo minuti, p.s. intendo la variabile XD
setInterval(() => {
  run();
}, minuti_controllo * 60 * 1000);
