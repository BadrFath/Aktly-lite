<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LiteDemandeController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'bce_data' => ['required', 'array'],
            'enterprise_number' => ['required', 'string'],
            'langue' => ['nullable', 'in:fr,nl'],
        ]);

        $demande = [
            'id' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'bce_data' => $validated['bce_data'],
            'enterprise_number' => $validated['enterprise_number'],
            'langue_entreprise' => $validated['langue'] ?? ($validated['bce_data']['lang_entre'] ?? 'fr'),
        ];

        return response()->json([
            'demande_id' => $demande['id'],
            'demande' => $demande,
        ]);
    }
}

