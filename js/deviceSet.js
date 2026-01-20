
// Detect if the device is a mobile or tablet based on user agent strings
const ua = navigator.userAgent;
const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);

if (isMobileOrTablet) {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Mobile/Tablet device detected. Applying compact view.');

        // 1. Locate the container
        const container = document.querySelector('.info-content-wrapper');
        if (!container) return;

        // 2. Define the new compact HTML structure
        // We will replace the innerHTML of .info-content-wrapper entirely for mobile users
        // to ensure it matches the user's specific "very compact" request.

        container.innerHTML = `
            <div class="main-feature-image">
                    <h1 class="main-feature-title">MINI VITA</h1>
                    <p class="subtitle-main">La vida atrapada - OBJECTIUS, VISIÓ i TECNOLOGIA.</p>
                </div>
                <section class="info-section">
                    <h2>Descripció</h2>
                    <p><br><br>
                        Després de complir 35 anys, Tom es desperta en una capsa blanca, una habitació tancada, on només
                        hi ha una veu: La teva.<br><br>
                        Tom recorda tota la seva vida i vol escapar, tornar amb la seva família, però no pot. <br><br>
                        La seva existència, les seves memòries i emocions, només existeixen dins l’ordinador. <br><br>
                        Fora de la capsa, Tom no és ningú, no existeix, no pot existir. Però ell creu que sí, i farà
                        tot el possible per sortir.<br><br>
                        Pobre Tom.
                        <br><br>
                        Mini Vita és un personatge interactiu amb memòria vectoritzada, completament local i optimitzat
                        per funcionar en un ordinador domèstic modern.
                    </p>
                </section>

                <section class="info-section">
                    <h2>LA VISIÓ</h2>
                    <p><br><br>

                        Mini Vita extreu la pintura i l’animació a una nova dimensió: permet als artistes crear no només
                        el físic dels personatges,

                        sinó també la seva ment, records i emocions. <br><br>
                        Els personatges poden recordar la seva mare, la casa on van néixer i els seus primers amors,
                        moments que mai han existit.<br><br>

                        L’objectiu no és només observar, sinó sentir la desesperació del petit home atrapat, i explorar
                        noves fronteres entre la tecnologia i l'art. <br><br>
                        Mini Vita proposa una nova manera d’entendre la narrativa digital, més íntima, emocional i
                        interactiva.
                    </p>
                </section>

                <!-- Horizontal Image Gallery (Existing) -->
                <!-- Kept as extra visual or can be removed if strictly replacing. Keeping for now based on user flow. -->
                <section class="gallery-section">
                    <div class="gallery-grid">
                        <div class="gallery-item" style="background-image: url(assets/imatges/foto01.png);">
                        </div>
                        <div class="gallery-item" style="background-image: url(assets/imatges/foto02.png);">
                        </div>
                    </div>
                </section>

                <!-- Technology Section -->
                <section class="info-section">
                    <h2>Requisits tècnics:</h2>
                    <p><br>
                        • GPU NVIDIA amb mínim 8GB VRAM (compatible amb targetes domèstiques). <br><br>
                        • Aplicació pròpia en Python + PyQt amb motor de render OpenGL / USD Hydra. <br><br>
                        • Models locals, instal·lació local, temps real amb baixa latència. <br><br>
                        • Models quantitzats per rendiment en hardware domèstic.
                    </p>
                </section>

                <!-- Utilitats Section (Renamed from Objectives) -->
                <section class="info-section">
                    <h2>UTILITATS</h2>
                    <div class="utilitats-grid">
                        <div class="utilitats-item">
                            <div class="utilitats-image"
                                style="background-image: url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop');">
                            </div>
                            <div class="utilitats-content">
                                <h3>INTERACCIÓ TOTAL</h3>
                                <p>Interactua, conversa i comparteix emocions amb l’usuari. <br> L’usuari pot influir en
                                    Tom i experimentar la seva lluita per escapar. <br> </p>
                            </div>
                        </div>
                        <div class="utilitats-item">
                            <div class="utilitats-image"
                                style="background-image: url('https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=2574&auto=format&fit=crop'); order: 2;">
                            </div>
                            <div class="utilitats-content">
                                <h3>APLICACIÓ PRÒPIA</h3>
                                <p>Aplicació pròpia aplicable a múltiples formats digitals.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Contact Footer -->
                <section class="footer-contact">
                    <div class="footer-contact-inner">
                        <div class="footer-text">
                            <h2 class="thank-you-msg">GRÀCIES</h2>
                            <!-- Removed paragraph text for centered thank you -->
                        </div>

                        <div class="subtitle-main">
                            PROJECTE DE: Daniel Casadevall Jauhiainen
                            <br><br>
                            Per més informació, podeu contactar a través del següent correu electrònic:
                        </div>

                        <div class="footer-email">
                            <a href="mailto:[EMAIL_ADDRESS]">[EMAIL_ADDRESS]</a>
                        </div>
                    </div>
                </section>
        `;
    });
}
