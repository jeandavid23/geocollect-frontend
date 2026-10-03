import LegalLayout from './LegalLayout'

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="octobre 2026">
      <p>
        La présente politique explique quelles données personnelles sont traitées dans la plateforme <b>GeoCollect EUDR</b>
        (la « Plateforme »), pourquoi, comment elles sont protégées et quels sont les droits des personnes concernées.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est [Nom de la coopérative / de l'opérateur], [adresse], joignable à [adresse e-mail].
        Chaque coopérative est responsable des données de ses producteurs et de ses agents. La Plateforme est éditée par <b>Jean David Konan</b>, qui agit comme
        sous-traitant technique, pour le compte des coopératives.
      </p>

      <h2>2. Données collectées</h2>
      <h3>Producteurs</h3>
      <ul>
        <li>identité : nom, prénoms, genre, année de naissance ;</li>
        <li>coordonnées : téléphone ;</li>
        <li>numéro de pièce d'identité nationale (lorsqu'il est renseigné) ;</li>
        <li>localisation : village, section, région ;</li>
        <li>données d'exploitation importées depuis les fichiers Excel de la coopérative.</li>
      </ul>
      <h3>Parcelles</h3>
      <ul>
        <li>géométries GPS (coordonnées des sommets), superficie, culture ;</li>
        <li>résultats d'analyse (conformité EUDR, déforestation, catégorie foncière).</li>
      </ul>
      <h3>Utilisateurs de la Plateforme</h3>
      <ul>
        <li>identifiant de connexion, nom, e-mail, téléphone, rôle, photo de profil (facultative) ;</li>
        <li>journaux techniques : date de connexion et adresse IP, à des fins de sécurité.</li>
      </ul>

      <h2>3. Finalités</h2>
      <ul>
        <li>la cartographie et le suivi des parcelles et des producteurs ;</li>
        <li>le contrôle de conformité au règlement EUDR / RDUE et la traçabilité ;</li>
        <li>la gestion des comptes et de la sécurité ;</li>
        <li>la production de rapports et d'exports pour la coopérative et ses acheteurs.</li>
      </ul>

      <h2>4. Base légale et consentement</h2>
      <p>
        Les données sont traitées sur la base de l'intérêt légitime des coopératives à assurer la traçabilité et la
        conformité EUDR, et, pour les données des producteurs, sur la base de leur consentement. La coopérative s'engage à
        informer chaque producteur et à recueillir son accord avant d'enregistrer ses données et sa parcelle.
      </p>

      <h2>5. Hébergement et localisation</h2>
      <p>
        La Plateforme est hébergée sur des infrastructures tierces : l'interface web sur Netlify, l'application serveur sur
        Render, et la base de données PostgreSQL sur Neon (serveurs situés dans l'Union européenne). Les fonds de carte
        proviennent de Google et d'OpenStreetMap ; les données de déforestation proviennent de l'Université du Maryland
        (Hansen Global Forest Change) via Google. Aucune donnée personnelle n'est transmise à ces fournisseurs de fonds de carte.
      </p>

      <h2>6. Durée de conservation</h2>
      <p>
        Les données sont conservées tant que la coopérative utilise la Plateforme et aussi longtemps que nécessaire au
        respect des obligations de traçabilité EUDR, puis supprimées ou anonymisées sur demande du responsable du traitement.
      </p>

      <h2>7. Partage des données</h2>
      <p>
        Les données ne sont ni vendues ni cédées à des tiers à des fins commerciales. Elles peuvent être communiquées aux
        acheteurs et aux autorités dans le cadre des obligations de conformité EUDR, à l'initiative de la coopérative, et aux
        sous-traitants techniques strictement nécessaires au fonctionnement du service.
      </p>

      <h2>8. Sécurité</h2>
      <ul>
        <li>connexions chiffrées (HTTPS) et mots de passe stockés sous forme chiffrée ;</li>
        <li>cloisonnement : chaque coopérative n'accède qu'à ses propres données ;</li>
        <li>limitation des tentatives de connexion et en-têtes de sécurité renforcés ;</li>
        <li>accès réservé aux utilisateurs authentifiés et autorisés.</li>
      </ul>

      <h2>9. Vos droits</h2>
      <p>
        Conformément à la réglementation applicable (notamment la loi n° 2013-450 relative à la protection des données à
        caractère personnel en Côte d'Ivoire, et le RGPD lorsqu'il s'applique), toute personne concernée dispose d'un droit
        d'accès, de rectification, d'effacement, d'opposition et de limitation du traitement de ses données. Ces droits
        s'exercent auprès de la coopérative responsable, à l'adresse [adresse e-mail de contact].
      </p>

      <h2>10. Modifications</h2>
      <p>
        La présente politique peut être mise à jour. La version applicable est celle publiée sur cette page. En cas de
        changement important, les utilisateurs en seront informés via la Plateforme.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question relative à vos données : [adresse e-mail] — [téléphone] — [adresse postale].</p>
    </LegalLayout>
  )
}
