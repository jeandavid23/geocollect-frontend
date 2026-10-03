import LegalLayout from './LegalLayout'

export default function CguPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updated="octobre 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions générales d'utilisation (les « CGU ») régissent l'accès et l'utilisation de la
        plateforme <b>GeoCollect EUDR</b> (la « Plateforme »), éditée par [Nom de l'éditeur / de la structure],
        [forme juridique], immatriculée sous le [RCCM / identifiant], dont le siège est situé à [adresse].
        La Plateforme permet la collecte GPS des parcelles agricoles, le suivi des producteurs et le contrôle de
        conformité au règlement de l'Union européenne sur la déforestation (EUDR / RDUE).
      </p>

      <h2>2. Acceptation</h2>
      <p>
        L'utilisation de la Plateforme suppose l'acceptation pleine et entière des présentes CGU. L'utilisateur qui
        n'accepte pas ces conditions ne doit pas utiliser la Plateforme. L'éditeur peut modifier les CGU à tout moment ;
        la version applicable est celle en vigueur à la date d'utilisation.
      </p>

      <h2>3. Comptes et rôles</h2>
      <p>L'accès est réservé aux utilisateurs disposant d'un compte, créé par un administrateur ou une coopérative. Trois rôles existent :</p>
      <ul>
        <li><b>Administrateur</b> : gère les coopératives et supervise l'ensemble des données.</li>
        <li><b>Coopérative</b> : gère ses producteurs, ses agents, son registre et ses analyses.</li>
        <li><b>Agent mappeur</b> : cartographie les parcelles sur le terrain.</li>
      </ul>
      <p>
        Chaque utilisateur est responsable de la confidentialité de ses identifiants et de toute activité réalisée depuis
        son compte. Tout usage non autorisé doit être signalé sans délai à [adresse e-mail de contact].
      </p>

      <h2>4. Utilisation conforme</h2>
      <p>L'utilisateur s'engage à :</p>
      <ul>
        <li>fournir des informations exactes et à jour (identité des producteurs, parcelles, documents) ;</li>
        <li>n'enregistrer que des données qu'il est légalement autorisé à collecter et à traiter ;</li>
        <li>obtenir le consentement des producteurs pour la collecte de leurs données personnelles et de leurs parcelles ;</li>
        <li>ne pas tenter d'accéder à des données d'une autre coopérative, ni de perturber le fonctionnement de la Plateforme ;</li>
        <li>respecter les lois applicables, notamment en matière de protection des données et de conformité EUDR.</li>
      </ul>

      <h2>5. Données et conformité EUDR</h2>
      <p>
        La Plateforme fournit des outils d'aide à la conformité (cartographie, détection de déforestation à partir des
        données Hansen Global Forest Change, matrice de risque RDUE, contrôle de la qualité des polygones). Ces résultats
        sont fournis à titre indicatif : ils ne constituent pas une attestation officielle de conformité. L'utilisateur
        reste seul responsable de l'exactitude des données saisies et des déclarations faites aux autorités ou aux acheteurs.
      </p>

      <h2>6. Propriété des données et du service</h2>
      <p>
        Les données saisies (producteurs, parcelles, registres) appartiennent à la coopérative ou à l'opérateur qui les a
        enregistrées. L'éditeur n'en acquiert aucun droit de propriété et s'interdit de les exploiter à d'autres fins que
        la fourniture du service. Le code, la marque et l'interface de la Plateforme demeurent la propriété de leurs auteurs respectifs.
      </p>

      <h2>7. Disponibilité</h2>
      <p>
        La Plateforme est fournie « en l'état ». L'éditeur met en œuvre des moyens raisonnables pour assurer sa
        disponibilité mais ne garantit pas un fonctionnement ininterrompu ou exempt d'erreurs. Des interruptions peuvent
        survenir pour maintenance, mise à jour ou cause indépendante de sa volonté (hébergeur, réseau).
      </p>

      <h2>8. Responsabilité</h2>
      <p>
        Dans les limites permises par la loi, l'éditeur ne saurait être tenu responsable des dommages indirects, pertes de
        données ou préjudices résultant d'une mauvaise utilisation de la Plateforme, de données erronées saisies par
        l'utilisateur, ou d'une indisponibilité temporaire du service. Il appartient à l'utilisateur de conserver des
        sauvegardes (exports Excel, GeoJSON, KML disponibles dans la Plateforme).
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la <a href="/confidentialite">politique de confidentialité</a>,
        qui fait partie intégrante des présentes CGU.
      </p>

      <h2>10. Droit applicable</h2>
      <p>
        Les présentes CGU sont régies par le droit [de la Côte d'Ivoire / du pays applicable]. Tout litige relatif à leur
        interprétation ou à leur exécution relève des juridictions compétentes de [ville / ressort], après recherche d'une
        solution amiable.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question relative aux présentes CGU : [adresse e-mail] — [téléphone] — [adresse postale].</p>
    </LegalLayout>
  )
}
