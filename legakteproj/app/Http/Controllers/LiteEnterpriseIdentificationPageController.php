<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LiteEnterpriseIdentificationPageController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $defaultLanguage = in_array($user->langue_user ?? null, ['fr', 'nl'], true) ? $user->langue_user : 'fr';

        return response()->json([
            'page' => 'identification-entreprise',
            'step' => 1,
            'title' => "Informations de l'entreprise",
            'description' => "Veuillez remplir les informations necessaires pour continuer.",
            'fields' => [
                [
                    'name' => 'enterprise_number',
                    'type' => 'text',
                    'label' => "Entrez le numero d'entreprise ici",
                    'required' => true,
                ],
                [
                    'name' => 'langue',
                    'type' => 'choice',
                    'label' => 'Selectionnez la langue :',
                    'required' => true,
                    'options' => [
                        ['value' => 'fr', 'label' => 'Francais'],
                        ['value' => 'nl', 'label' => 'Nederlands'],
                    ],
                    'default' => $defaultLanguage,
                ],
            ],
            'cta' => [
                'label' => 'Rechercher',
            ],
            'endpoints' => [
                'search' => url('/lite/identification-entreprise/search'),
                'create_demande' => url('/lite/identification-entreprise/demandes'),
            ],
        ]);
    }
}

