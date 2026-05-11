<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LiteKboController extends Controller
{
    public function search(Request $request)
    {
        $validated = $request->validate([
            'enterprise_number' => ['required', 'string'],
            'langue' => ['required', 'in:fr,nl'],
        ]);

        $enterpriseNumber = preg_replace('/\D+/', '', $validated['enterprise_number']);
        $lang = $validated['langue'];

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
        ]);
    }
}

