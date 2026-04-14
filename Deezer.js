import fetch from "node-fetch";
import * as url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const DEEZER_TIMERS = new Map();

export async function init() {

}

export async function action(data, callback) {
    try {
        const tblActions = {
            getDeezer: () => DeezerMusic(data, data.client),
            stopDeezer: () => stopMusic(data, data.client)
        };

        info("Deezer:", data.action.command, L.get("plugin.from"), data.client);

        await tblActions[data.action.command]();

    } catch (err) {
        if (data.client) Avatar.Speech.end(data.client);
        if (err.message) error(err.message);
    }

    callback();
}

const DeezerMusic = async (data, client) => {
    const sentence = (data.rawSentence || data.action.sentence || "").toLowerCase();

    const artist = sentence
        .replace(/lance|demarre|démarre|joue|mets|deezer|avec/gi, "")
        .trim();

    if (!artist) {
        Avatar.speak("Quel artiste veux-tu écouter ?", client);
        return;
    }

    try {
        const search = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}`);
        const jsonArtist = await search.json();

        if (!jsonArtist?.data?.length) {
            Avatar.speak("Je n'ai rien trouvé sur Deezer", client);
            return;
        }

        const artistId = jsonArtist.data[0].id;

        const res = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=50`);
        const json = await res.json();

        if (!json?.data?.length) {
            Avatar.speak("Aucun titre trouvé", client);
            return;
        }

        const tracks = json.data.filter(t => t.preview);

        if (!tracks.length) {
            Avatar.speak("Aucun extrait disponible", client);
            return;
        }

        const playMultipleTracks = (tracks, client, count = 5) => {
            const shuffled = tracks.sort(() => Math.random() - 0.5).slice(0, count);
            let index = 0;

            const playNext = () => {
                if (index >= shuffled.length) return;
                const track = shuffled[index];
                index++;

                Avatar.speak(`Je lance ${track.title}`, client);

                const delay = Math.max(1500, track.title.length * 80);

                const mainTimeout = setTimeout(() => {
                    Avatar.play(track.preview, client, 'url', 'after');

                    const nextTrackTimeout = setTimeout(playNext, 30000);
                    DEEZER_TIMERS.set(client, { mainTimeout, nextTrackTimeout });
                }, delay);

                DEEZER_TIMERS.set(client, { mainTimeout });
            };

            playNext();
        };

        playMultipleTracks(tracks, client, 5);

    } catch (e) {
        error("Deezer error:", e);
        Avatar.speak("Erreur Deezer", client);
    }
};

const stopMusic = (data, client) => {
    const timers = DEEZER_TIMERS.get(client);
    if (timers) {
        if (timers.mainTimeout) clearTimeout(timers.mainTimeout);
        if (timers.nextTrackTimeout) clearTimeout(timers.nextTrackTimeout);
        DEEZER_TIMERS.delete(client);
    }

    Avatar.stop(client);
    Avatar.speak("Lecture Deezer arrêtée", client);
};
