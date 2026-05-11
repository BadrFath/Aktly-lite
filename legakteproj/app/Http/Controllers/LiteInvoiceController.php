<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LiteInvoiceController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([]);
    }

    public function receipts(Request $request)
    {
        return response()->json([]);
    }
}

