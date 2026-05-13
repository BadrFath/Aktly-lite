<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LiteDossierController extends Controller
{
    public function generate(Request $request, string $document)
    {
        $validated = $request->validate([
            'company_data' => ['nullable', 'array'],
            'address_info' => ['nullable', 'array'],
            'depositaire' => ['nullable', 'array'],
            'user' => ['nullable', 'array'],
            'payment' => ['nullable', 'array'],
        ]);

        $company = $validated['company_data'] ?? [];
        $address = $validated['address_info'] ?? [];
        $depositaire = $validated['depositaire'] ?? [];
        $user = $validated['user'] ?? [];
        $payment = $validated['payment'] ?? [];

        $content = $this->buildDocumentContent($document, $company, $address, $depositaire, $user, $payment);

        if ($content === null) {
            return response()->json(['message' => 'Document inconnu.'], 404);
        }

        $fileName = $document.'-'.date('Ymd-His').'.txt';

        return response($content, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }

    private function buildDocumentContent(
        string $document,
        array $company,
        array $address,
        array $depositaire,
        array $user,
        array $payment
    ): ?string {
        $companyName = $company['company_name'] ?? 'Non renseigne';
        $enterpriseNumber = $company['number'] ?? 'Non renseigne';
        $legalForm = $company['enterprise']['legalForm'] ?? 'Non renseigne';
        $companyAddress = $company['address'] ?? 'Non renseignee';
        $status = $company['juridicalSituation']['status']['description'][0]['value'] ?? 'Non renseigne';
        $changeDate = $address['dateChangement'] ?? 'Non renseignee';
        $agDate = $address['dateAssembleeGenerale'] ?? 'Non renseignee';
        $newStreet = trim(($address['rue'] ?? '').' '.($address['numero'] ?? ''));
        $newBox = $address['boite'] ?? '';
        $newPostal = $address['codePostal'] ?? '';
        $newCity = $address['commune'] ?? '';
        $newAddressLine = trim($newStreet.($newBox !== '' ? ' boite '.$newBox : ''));
        $newAddress = trim($newAddressLine.' - '.$newPostal.' '.$newCity);
        $depositaireName = trim(($depositaire['dirigeant']['givenName'] ?? '').' '.($depositaire['dirigeant']['surname'] ?? ''));
        $depositaireFunction = $depositaire['dirigeant']['function'] ?? 'Non renseignee';
        $depositaireType = $depositaire['depositaire_type'] ?? 'Non renseigne';
        $userName = $user['name'] ?? 'Non renseigne';
        $userEmail = $user['email'] ?? 'Non renseigne';
        $pack = $payment['pack']['slug'] ?? 'Non renseigne';
        $credits = $payment['pack']['credits'] ?? '0';

        $header = "Aktly Lite - Document pre-rempli\n";
        $header .= "Generation: ".date('Y-m-d H:i:s')."\n\n";

        $common = "Entreprise: {$companyName}\n";
        $common .= "Numero BCE: {$enterpriseNumber}\n";
        $common .= "Forme juridique: {$legalForm}\n";
        $common .= "Statut: {$status}\n";
        $common .= "Adresse BCE actuelle: {$companyAddress}\n";
        $common .= "Nouvelle adresse: {$newAddress}\n";
        $common .= "Date changement: {$changeDate}\n";
        $common .= "Date AG: {$agDate}\n";
        $common .= "Depositaire: {$depositaireName} ({$depositaireFunction})\n";
        $common .= "Type depositaire: {$depositaireType}\n";
        $common .= "Utilisateur: {$userName} - {$userEmail}\n";
        $common .= "Pack: {$pack} - Credits: {$credits}\n\n";

        return match ($document) {
            'formulaire1entr' => $header."FORMULAIRE 1 - MODIFICATION ENTREPRISE\n\n".$common,
            'formulaire2entr' => $header."FORMULAIRE 2 - DONNEES COMPLEMENTAIRES\n\n".$common,
            'attestation-identite' => $header."ATTESTATION D'IDENTITE - MODELE 1\n\n".$common,
            'pv-assemblee-generale' => $header."PROCES-VERBAL DE L'ASSEMBLEE GENERALE\n\n".$common.
                "Resolution\n".
                "L'assemblee generale de {$companyName} decide de transferer le siege social a {$newAddress}.\n".
                "La decision prend effet a la date du {$changeDate}.\n",
            default => null,
        };
    }
}
