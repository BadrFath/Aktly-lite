<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\LiteStripePageController;
use App\Http\Controllers\LiteEnterpriseIdentificationPageController;
use App\Http\Controllers\LiteCheckoutController;
use App\Http\Controllers\LiteDossierController;
use App\Http\Controllers\LiteInvoiceController;
use App\Http\Controllers\LiteKboController;
use App\Http\Controllers\LiteDemandeController;

Route::middleware('auth:sanctum')->prefix('lite')->group(function () {
    Route::get('/stripe', [LiteStripePageController::class, 'index'])->name('lite.stripe.index');
    Route::post('/stripe/checkout/{slug}', [LiteCheckoutController::class, 'create'])->name('lite.stripe.checkout');
    Route::get('/stripe/invoices', [LiteInvoiceController::class, 'index'])->name('lite.stripe.invoices');
    Route::get('/stripe/receipts', [LiteInvoiceController::class, 'receipts'])->name('lite.stripe.receipts');
    Route::get('/stripe/success', [LiteCheckoutController::class, 'success'])->name('lite.stripe.success');
    Route::get('/stripe/cancel', [LiteCheckoutController::class, 'cancel'])->name('lite.stripe.cancel');

    Route::get('/identification-entreprise', [LiteEnterpriseIdentificationPageController::class, 'index'])
        ->name('lite.enterprise-identification.index');
    Route::post('/identification-entreprise/search', [LiteKboController::class, 'search'])
        ->name('lite.enterprise-identification.search');
    Route::post('/identification-entreprise/demandes', [LiteDemandeController::class, 'store'])
        ->name('lite.enterprise-identification.demandes.store');

    Route::post('/dossier/generate/{document}', [LiteDossierController::class, 'generate'])
        ->name('lite.dossier.generate');
});

Route::post('/lite/stripe/webhook', [LiteCheckoutController::class, 'handleWebhook'])->name('lite.stripe.webhook');

