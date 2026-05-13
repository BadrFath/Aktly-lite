<?php

namespace App\Http\Controllers;

use App\Http\Services\BceSoapService;
use Illuminate\Http\Request;
use RuntimeException;

class LiteKboController extends Controller
{
    public function __construct(private readonly BceSoapService $bceSoapService)
    {
    }

    public function search(Request $request)
    {
        $validated = $request->validate([
            'enterprise_number' => ['required', 'string'],
            'langue' => ['required', 'in:fr,nl'],
        ]);

        $enterpriseNumber = preg_replace('/\D+/', '', $validated['enterprise_number']);
        $lang = $validated['langue'];

        try {
            $payload = $this->bceSoapService->readEnterprise($enterpriseNumber, $lang);

            return response()->json($payload);
        } catch (RuntimeException $exception) {
            return response()->json([
                'lang_entre' => $lang,
                'number' => $enterpriseNumber,
                'typeOfEnterprise' => 'ELP',
                'juridicalSituation' => [
                    'status' => [
                        'description' => [[
                            'value' => $lang === 'nl' ? 'Actief' : 'Actif',
                            'language' => $lang,
                        ]],
                    ],
                ],
                'denomination' => [[
                    'description' => [[
                        'value' => 'Entreprise '.$enterpriseNumber,
                        'language' => $lang,
                    ]],
                ]],
                'fallback' => true,
                'fallback_reason' => $exception->getMessage(),
            ]);
        }
    }
}

