<?php

namespace App\Http\Services;

use RuntimeException;

class BceSoapService
{
    private string $url;
    private string $username;
    private string $password;

    public function __construct(?string $url = null, ?string $username = null, ?string $password = null)
    {
        $this->url = $url ?? (string) getenv('BCE_SOAP_URL');
        $this->username = $username ?? (string) getenv('BCE_SOAP_USERNAME');
        $this->password = $password ?? (string) getenv('BCE_SOAP_PASSWORD');
    }

    public function isConfigured(): bool
    {
        return $this->url !== '' && $this->username !== '' && $this->password !== '';
    }

    public function readEnterprise(string $enterpriseNumber, string $language = 'fr'): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('BCE SOAP service is not configured.');
        }

        $enterpriseNumber = preg_replace('/\D+/', '', $enterpriseNumber) ?? '';
        $language = in_array($language, ['fr', 'nl'], true) ? $language : 'fr';

        [$nonce, $created, $expires, $passwordDigest] = $this->buildWsseTokens();

        $soapRequest = $this->buildSoapRequest(
            $enterpriseNumber,
            $language,
            $nonce,
            $created,
            $expires,
            $passwordDigest
        );

        $xmlPayload = $this->sendSoapRequest($soapRequest);

        return $this->mapSoapResponse($xmlPayload, $enterpriseNumber, $language);
    }

    private function sendSoapRequest(string $soapRequest): string
    {
        $ch = curl_init($this->url);
        if ($ch === false) {
            throw new RuntimeException('Unable to initialize cURL for BCE SOAP call.');
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: text/xml; charset=utf-8',
                'SOAPAction: http://economie.fgov.be/kbopub/webservices/v1/messages/ReadEnterprise',
            ],
            CURLOPT_POSTFIELDS => $soapRequest,
            CURLOPT_TIMEOUT => 20,
        ]);

        $responseBody = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($responseBody === false) {
            $errorMessage = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException('BCE SOAP request failed: '.$errorMessage);
        }

        curl_close($ch);

        if ($httpCode < 200 || $httpCode >= 300) {
            throw new RuntimeException('BCE SOAP returned HTTP '.$httpCode.'.');
        }

        return (string) $responseBody;
    }

    private function buildWsseTokens(): array
    {
        $nonceBytes = random_bytes(16);
        $nonce = base64_encode($nonceBytes);
        $created = gmdate('Y-m-d\TH:i:s\Z');
        $expires = gmdate('Y-m-d\TH:i:s\Z', strtotime('+10 minutes'));
        $passwordDigest = base64_encode(sha1($nonceBytes.$created.$this->password, true));

        return [$nonce, $created, $expires, $passwordDigest];
    }

    private function buildSoapRequest(
        string $enterpriseNumber,
        string $language,
        string $nonce,
        string $created,
        string $expires,
        string $passwordDigest
    ): string {
        return sprintf(
            <<<'XML'
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:mes="http://economie.fgov.be/KBOpub/webservices/v1/messages"
                  xmlns:dat="http://economie.fgov.be/KBOpub/webservices/v1/datamodel"
                  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
                  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
    <soapenv:Header>
        <wsse:Security>
            <wsse:UsernameToken wsu:Id="%s">
                <wsse:Username>%s</wsse:Username>
                <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">%s</wsse:Password>
                <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">%s</wsse:Nonce>
                <wsu:Created>%s</wsu:Created>
            </wsse:UsernameToken>
            <wsu:Timestamp wsu:Id="%s">
                <wsu:Created>%s</wsu:Created>
                <wsu:Expires>%s</wsu:Expires>
            </wsu:Timestamp>
        </wsse:Security>
        <mes:RequestContext>
            <mes:Id>%s</mes:Id>
            <mes:Language>%s</mes:Language>
        </mes:RequestContext>
    </soapenv:Header>
    <soapenv:Body>
        <mes:ReadEnterpriseRequest>
            <dat:EnterpriseNumber>%s</dat:EnterpriseNumber>
        </mes:ReadEnterpriseRequest>
    </soapenv:Body>
</soapenv:Envelope>
XML,
            $this->generateUniqueId('UsernameToken'),
            htmlspecialchars($this->username, ENT_XML1),
            htmlspecialchars($passwordDigest, ENT_XML1),
            htmlspecialchars($nonce, ENT_XML1),
            htmlspecialchars($created, ENT_XML1),
            $this->generateUniqueId('TS'),
            htmlspecialchars($created, ENT_XML1),
            htmlspecialchars($expires, ENT_XML1),
            $this->generateUuid(),
            htmlspecialchars($language, ENT_XML1),
            htmlspecialchars($enterpriseNumber, ENT_XML1)
        );
    }

    private function mapSoapResponse(string $xmlPayload, string $enterpriseNumber, string $language): array
    {
        $xml = simplexml_load_string($xmlPayload);
        if ($xml === false) {
            throw new RuntimeException('BCE SOAP response cannot be parsed.');
        }

        $companyName = $this->extractBestByLanguage(
            $xml,
            [
                "//*[local-name()='Denomination']/*[local-name()='Description']",
                "//*[local-name()='Name']/*[local-name()='Description']",
            ],
            $language
        );

        $status = $this->extractBestByLanguage(
            $xml,
            [
                "//*[local-name()='JuridicalSituation']//*[local-name()='Status']/*[local-name()='Description']",
                "//*[local-name()='Status']/*[local-name()='Description']",
            ],
            $language
        );

        $enterpriseType = $this->extractFirstValue($xml, [
            "string(//*[local-name()='TypeOfEnterprise'])",
            "string(//*[local-name()='EnterpriseType'])",
        ]) ?: 'ELP';

        $address = $this->extractAddress($xml);
        $legalForm = $this->extractBestByLanguage(
            $xml,
            [
                "//*[local-name()='LegalForm']/*[local-name()='Description']",
                "//*[local-name()='JuridicalForm']/*[local-name()='Description']",
            ],
            $language
        );
        $startDate = $this->extractFirstValue($xml, [
            "string(//*[local-name()='StartDate'])",
            "string(//*[local-name()='CreationDate'])",
        ]);
        $startDate = $this->normalizeDate($startDate);
        $hasVat = $this->extractFirstValue($xml, [
            "string(//*[local-name()='VatLiable'])",
            "string(//*[local-name()='VATLiable'])",
        ]);

        return [
            'lang_entre' => $language,
            'number' => $this->extractFirstValue($xml, ["string(//*[local-name()='EnterpriseNumber'])"]) ?: $enterpriseNumber,
            'typeOfEnterprise' => $enterpriseType,
            'juridicalSituation' => [
                'status' => [
                    'description' => [[
                        'value' => $status ?: ($language === 'nl' ? 'Actief' : 'Actif'),
                        'language' => $language,
                    ]],
                ],
            ],
            'denomination' => [[
                'description' => [[
                    'value' => $companyName ?: ('Entreprise '.$enterpriseNumber),
                    'language' => $language,
                ]],
            ]],
            'address' => $address['full'],
            'addresses' => [$address],
            'enterprise' => [
                'legalForm' => $legalForm,
                'startDate' => $startDate,
                'vatLiable' => $hasVat,
            ],
        ];
    }

    private function extractAddress(\SimpleXMLElement $xml): array
    {
        $street = $this->extractFirstValue($xml, [
            "string(//*[local-name()='Street'])",
            "string(//*[local-name()='StreetFR'])",
            "string(//*[local-name()='StreetNL'])",
            "string(//*[local-name()='StreetName'])",
        ]) ?? '';
        $houseNumber = $this->extractFirstValue($xml, [
            "string(//*[local-name()='HouseNumber'])",
            "string(//*[local-name()='HouseNr'])",
            "string(//*[local-name()='Number'])",
        ]) ?? '';
        $box = $this->extractFirstValue($xml, [
            "string(//*[local-name()='Box'])",
            "string(//*[local-name()='Bus'])",
        ]) ?? '';
        $postalCode = $this->extractFirstValue($xml, [
            "string(//*[local-name()='Zipcode'])",
            "string(//*[local-name()='PostalCode'])",
        ]) ?? '';
        $municipality = $this->extractBestByLanguage(
            $xml,
            [
                "//*[local-name()='Municipality']/*[local-name()='Description']",
                "//*[local-name()='MunicipalityName']/*[local-name()='Description']",
            ],
            'fr'
        ) ?: ($this->extractFirstValue($xml, ["string(//*[local-name()='Municipality'])"]) ?? '');
        $country = $this->extractBestByLanguage(
            $xml,
            [
                "//*[local-name()='Country']/*[local-name()='Description']",
            ],
            'fr'
        ) ?: ($this->extractFirstValue($xml, ["string(//*[local-name()='Country'])"]) ?? 'Belgique');

        $lineOneParts = array_filter([$street, $houseNumber]);
        $lineOne = implode(' ', $lineOneParts);
        if ($box !== '') {
            $lineOne = trim($lineOne.' boite '.$box);
        }

        $lineTwo = trim(implode(' ', array_filter([$postalCode, $municipality])));
        $full = trim(implode(', ', array_filter([$lineOne, $lineTwo, $country])));

        return [
            'street' => $street,
            'houseNumber' => $houseNumber,
            'box' => $box,
            'postalCode' => $postalCode,
            'municipality' => $municipality,
            'country' => $country,
            'full' => $full,
        ];
    }

    private function normalizeDate(?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        $cleaned = trim($value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $cleaned) === 1) {
            return $cleaned;
        }

        if (preg_match('/^(\d{4})(\d{2})(\d{2})$/', $cleaned, $matches) === 1) {
            return $matches[1].'-'.$matches[2].'-'.$matches[3];
        }

        return $cleaned;
    }

    private function extractFirstValue(\SimpleXMLElement $xml, array $xpaths): ?string
    {
        foreach ($xpaths as $xpath) {
            $result = $xml->xpath($xpath);
            if ($result === false || $result === []) {
                continue;
            }

            $value = trim((string) $result[0]);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function extractBestByLanguage(\SimpleXMLElement $xml, array $xpaths, string $language): ?string
    {
        $entries = [];

        foreach ($xpaths as $xpath) {
            $nodes = $xml->xpath($xpath);
            if (! is_array($nodes)) {
                continue;
            }

            foreach ($nodes as $node) {
                $value = trim((string) ($node->Value ?? $node->value ?? $node));
                if ($value === '') {
                    continue;
                }

                $lang = strtolower(trim((string) ($node->Language ?? $node->language ?? '')));
                $entries[] = ['value' => $value, 'language' => $lang];
            }
        }

        foreach ($entries as $entry) {
            if ($entry['language'] === strtolower($language)) {
                return $entry['value'];
            }
        }

        return $entries[0]['value'] ?? null;
    }

    private function generateUuid(): string
    {
        return sprintf(
            '%08x-%04x-%04x-%04x-%12x',
            mt_rand(0, 0xffffffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffffffffffff)
        );
    }

    private function generateUniqueId(string $prefix): string
    {
        $uuid = str_replace('.', '', uniqid('', true));

        return $prefix.'-'.substr($uuid, 0, 32);
    }
}